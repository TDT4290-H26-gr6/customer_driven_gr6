import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { buildPieContent } from "../assessment/assessment.pie";
import {
  historiesFrom,
  NO_HISTORY,
  recordChange,
  snapshot,
  type Actor,
  type EntityType,
} from "./curriculum.audit";
import type {
  CompetenceInput,
  JourneyInput,
  ModuleInput,
  QuestionInput,
  SectionInput,
} from "./curriculum.validation";

// The curriculum editor (admin): changing the content learners are assessed
// on. Writes the assessment module's tables (questions, competences) on behalf
// of an admin, the one other module allowed to (context/backend-structure.md).
// Content lives in the database: db-init only loads a dataset into an empty
// one, so what's changed here stays changed. Every change is logged with who
// made it (curriculum.audit.ts), in the same transaction as the change.

/** Prisma's "unique constraint failed" (e.g. a competence name already taken). */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

const questionSummarySelect = {
  id: true,
  prompt: true,
  questionType: true,
  sectionModuleId: true,
  competenceId: true,
  retiredAt: true,
  authoredContent: true,
  _count: { select: { responses: true } },
} satisfies Prisma.QuestionSelect;

type QuestionRow = Prisma.QuestionGetPayload<{ select: typeof questionSummarySelect }>;

function toQuestionSummary({ _count, authoredContent, ...question }: QuestionRow) {
  return {
    ...question,
    /** How many saved answers it has, in any attempt; retiring instead of deleting starts at 1. */
    answerCount: _count.responses,
    /** Questions loaded before the editor existed have no authored form until db-init fills it in. */
    editable: authoredContent !== null,
  };
}

/**
 * Everything the editor's overview needs in one read: sections with their
 * modules (by code, then level), every competence with how many questions use
 * it, and every question, retired ones included.
 */
export async function getCurriculum() {
  const [sections, competences, questions, journeys, sources, log] = await Promise.all([
    prisma.section.findMany({
      orderBy: [{ code: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        retiredAt: true,
        _count: { select: { journeySections: true, satInstances: true } },
        modules: {
          orderBy: [{ level: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            description: true,
            level: true,
            mainCompetenceId: true,
            moodleUrl: true,
            retiredAt: true,
            secondaryCompetences: { select: { competenceId: true } },
            _count: { select: { questions: true } },
          },
        },
      },
    }),
    prisma.competence.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { questions: true, mainForModules: true } },
      },
    }),
    prisma.question.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: questionSummarySelect,
    }),
    prisma.learningJourney.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        moodleUrl: true,
        retiredAt: true,
        sections: { select: { sectionId: true, coverageLevel: true } },
        modules: {
          orderBy: { order: "asc" },
          select: { id: true, title: true, description: true, sourceId: true },
        },
        _count: {
          select: {
            recommendations: true,
            chosenInAdvice: true,
            runnerUpInAdvice: true,
            satInstances: true,
            assessedIn: true,
          },
        },
      },
    }),
    prisma.source.findMany({
      orderBy: [{ institution: "asc" }, { courseName: "asc" }],
      select: { id: true, courseName: true, institution: true },
    }),
    // Only what each item's history needs (who and when), oldest first.
    prisma.auditEvent.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        entityType: true,
        entityId: true,
        action: true,
        createdAt: true,
        actorName: true,
        actorEmail: true,
      },
    }),
  ]);

  const histories = historiesFrom(log);
  const historyOf = (type: EntityType, id: string) => histories.get(`${type}:${id}`) ?? NO_HISTORY;

  return {
    sections: sections.map(({ _count, modules, ...section }) => ({
      ...section,
      history: historyOf("section", section.id),
      /** Journeys covering it: a section anything points at is retired, not deleted. */
      journeyCount: _count.journeySections,
      /** Whether learners have been assessed with it in scope (a reassessment limited to it). */
      usedInAssessments: _count.satInstances > 0,
      modules: modules.map(({ _count: moduleCount, secondaryCompetences, ...module }) => ({
        ...module,
        history: historyOf("module", module.id),
        secondaryCompetenceIds: secondaryCompetences.map((c) => c.competenceId),
        questionCount: moduleCount.questions,
      })),
    })),
    competences: competences.map(({ _count, ...competence }) => ({
      ...competence,
      history: historyOf("competence", competence.id),
      questionCount: _count.questions,
      moduleCount: _count.mainForModules,
    })),
    questions: questions.map((q) => ({
      ...toQuestionSummary(q),
      history: historyOf("question", q.id),
    })),
    journeys: journeys.map(({ _count, modules, ...journey }) => ({
      ...journey,
      history: historyOf("journey", journey.id),
      steps: modules,
      /** Recommended, picked by the AI, assessed or completed: removing it then retires it. */
      used: Object.values(_count).some((n) => n > 0),
    })),
    sources,
  };
}

/** One question with its authored form, for the edit page. Null when it doesn't exist. */
export async function getQuestion(id: string) {
  const question = await prisma.question.findUnique({
    where: { id },
    select: questionSummarySelect,
  });
  if (!question) return null;
  return { ...toQuestionSummary(question), authoredContent: question.authoredContent };
}

type Tx = Prisma.TransactionClient;

/**
 * Runs one admin change and its log entry in a single transaction: the item's
 * values before, the change, its values after, then the entry. If anything
 * fails, nothing is kept, so there's never a change without its entry.
 */
async function logged<T>(
  actor: Actor,
  type: EntityType,
  run: (
    tx: Tx,
  ) => Promise<
    | { id: string; action: "created" | "edited" | "deleted" | "retired" | "restored"; result: T }
    | { skip: T }
  >,
  existingId?: string,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const before = existingId ? await snapshot(tx, type, existingId) : null;
    const outcome = await run(tx);
    if ("skip" in outcome) return outcome.skip;
    const after = outcome.action === "deleted" ? null : await snapshot(tx, type, outcome.id);
    await recordChange(tx, actor, {
      entityType: type,
      entityId: outcome.id,
      action: outcome.action,
      before,
      after,
    });
    return outcome.result;
  });
}

/** Whether the module and competence a question points at exist. */
async function placementExists(tx: Tx, input: QuestionInput) {
  const [module, competence] = await Promise.all([
    tx.sectionModule.findUnique({ where: { id: input.sectionModuleId }, select: { id: true } }),
    tx.competence.findUnique({ where: { id: input.competenceId }, select: { id: true } }),
  ]);
  return module !== null && competence !== null;
}

/** The columns a question's input sets: the authored form, and the PIE item built from it. */
function questionData(input: QuestionInput) {
  return {
    questionType: input.questionType,
    prompt: input.prompt,
    authoredContent: input.content as Prisma.InputJsonObject,
    content: buildPieContent(
      input.questionType,
      input.prompt,
      input.content,
    ) as Prisma.InputJsonObject,
    sectionModuleId: input.sectionModuleId,
    competenceId: input.competenceId,
  };
}

export type SaveResult =
  { ok: true; id: string } | { ok: false; status: 400 | 404 | 409; error: string };

type Removal = "deleted" | "retired" | null;

export function createQuestion(actor: Actor, input: QuestionInput): Promise<SaveResult> {
  return logged<SaveResult>(actor, "question", async (tx) => {
    if (!(await placementExists(tx, input))) {
      return {
        skip: { ok: false, status: 400, error: "The module or competence no longer exists" },
      };
    }
    const { id } = await tx.question.create({ data: questionData(input), select: { id: true } });
    return { id, action: "created", result: { ok: true, id } };
  });
}

/**
 * Saves an edit. A question learners have answered keeps its type: their saved
 * answers are in that type's shape, so a different type means retiring it and
 * adding a new question. Answers already saved keep the score they got.
 */
export function updateQuestion(
  actor: Actor,
  id: string,
  input: QuestionInput,
): Promise<SaveResult> {
  return logged<SaveResult>(
    actor,
    "question",
    async (tx) => {
      const existing = await tx.question.findUnique({
        where: { id },
        select: { questionType: true, _count: { select: { responses: true } } },
      });
      if (!existing) return { skip: { ok: false, status: 404, error: "Unknown question" } };
      if (existing._count.responses > 0 && existing.questionType !== input.questionType) {
        return {
          skip: {
            ok: false,
            status: 409,
            error:
              "Learners have answered this question, so its type can't change. Remove it and add a new question instead.",
          },
        };
      }
      if (!(await placementExists(tx, input))) {
        return {
          skip: { ok: false, status: 400, error: "The module or competence no longer exists" },
        };
      }
      await tx.question.update({ where: { id }, data: questionData(input) });
      return { id, action: "edited", result: { ok: true, id } };
    },
    id,
  );
}

/**
 * Removes a question. One nobody has answered is deleted; one with answers is
 * retired instead, so past answers and results still have it to point at, and
 * it can be restored. Null when the question doesn't exist.
 */
export function removeQuestion(actor: Actor, id: string): Promise<Removal> {
  return logged<Removal>(
    actor,
    "question",
    async (tx) => {
      const question = await tx.question.findUnique({
        where: { id },
        select: { _count: { select: { responses: true } } },
      });
      if (!question) return { skip: null };
      if (question._count.responses === 0) {
        await tx.question.delete({ where: { id } });
        return { id, action: "deleted", result: "deleted" };
      }
      await tx.question.update({ where: { id }, data: { retiredAt: new Date() } });
      return { id, action: "retired", result: "retired" };
    },
    id,
  );
}

/** Brings a retired question back into the assessment. False when it doesn't exist. */
export function restoreQuestion(actor: Actor, id: string): Promise<boolean> {
  return logged<boolean>(
    actor,
    "question",
    async (tx) => {
      const { count } = await tx.question.updateMany({ where: { id }, data: { retiredAt: null } });
      return count > 0 ? { id, action: "restored", result: true } : { skip: false };
    },
    id,
  );
}

const competenceSelect = { id: true, name: true, description: true } as const;
type CompetenceRow = { id: string; name: string; description: string | null };

export function createCompetence(actor: Actor, input: CompetenceInput): Promise<CompetenceRow> {
  return logged<CompetenceRow>(actor, "competence", async (tx) => {
    const competence = await tx.competence.create({ data: input, select: competenceSelect });
    return { id: competence.id, action: "created", result: competence };
  });
}

/** Renames / re-describes a competence. Null when it doesn't exist. */
export function updateCompetence(
  actor: Actor,
  id: string,
  input: CompetenceInput,
): Promise<CompetenceRow | null> {
  return logged<CompetenceRow | null>(
    actor,
    "competence",
    async (tx) => {
      const { count } = await tx.competence.updateMany({ where: { id }, data: input });
      if (count === 0) return { skip: null };
      const competence = await tx.competence.findUnique({
        where: { id },
        select: competenceSelect,
      });
      return { id, action: "edited", result: competence };
    },
    id,
  );
}

// --- Sections and section modules (phase 2) ---

export type WriteResult =
  { ok: true; id: string } | { ok: false; status: 400 | 404; error: string };

export function createSection(actor: Actor, input: SectionInput): Promise<WriteResult> {
  return logged<WriteResult>(actor, "section", async (tx) => {
    const { id } = await tx.section.create({ data: input, select: { id: true } });
    return { id, action: "created", result: { ok: true, id } };
  });
}

export function updateSection(actor: Actor, id: string, input: SectionInput): Promise<WriteResult> {
  return logged<WriteResult>(
    actor,
    "section",
    async (tx) => {
      const { count } = await tx.section.updateMany({ where: { id }, data: input });
      if (count === 0) return { skip: { ok: false, status: 404, error: "Unknown section" } };
      return { id, action: "edited", result: { ok: true, id } };
    },
    id,
  );
}

/**
 * Removes a section. An empty one (no modules, no journey covering it, never
 * a reassessment's scope) is deleted; any other is retired, so nothing it's
 * part of is lost and it can be restored. Retiring hides it, and everything
 * in it, from the assessment, recommendations and the Competencies tab.
 */
export function removeSection(actor: Actor, id: string): Promise<Removal> {
  return logged<Removal>(
    actor,
    "section",
    async (tx) => {
      const section = await tx.section.findUnique({
        where: { id },
        select: {
          _count: { select: { modules: true, journeySections: true, satInstances: true } },
        },
      });
      if (!section) return { skip: null };
      const { modules, journeySections, satInstances } = section._count;
      if (modules + journeySections + satInstances === 0) {
        await tx.section.delete({ where: { id } });
        return { id, action: "deleted", result: "deleted" };
      }
      await tx.section.update({ where: { id }, data: { retiredAt: new Date() } });
      return { id, action: "retired", result: "retired" };
    },
    id,
  );
}

export function restoreSection(actor: Actor, id: string): Promise<boolean> {
  return logged<boolean>(
    actor,
    "section",
    async (tx) => {
      const { count } = await tx.section.updateMany({ where: { id }, data: { retiredAt: null } });
      return count > 0 ? { id, action: "restored", result: true } : { skip: false };
    },
    id,
  );
}

/** Whether the section and every competence a module points at exist. */
async function moduleRefsExist(tx: Tx, input: ModuleInput) {
  const competenceIds = [input.mainCompetenceId, ...input.secondaryCompetenceIds];
  const [section, competences] = await Promise.all([
    tx.section.findUnique({ where: { id: input.sectionId }, select: { id: true } }),
    tx.competence.count({ where: { id: { in: competenceIds } } }),
  ]);
  return section !== null && competences === competenceIds.length;
}

function moduleData({ secondaryCompetenceIds: _secondary, ...input }: ModuleInput) {
  return input;
}

export function createModule(actor: Actor, input: ModuleInput): Promise<WriteResult> {
  return logged<WriteResult>(actor, "module", async (tx) => {
    if (!(await moduleRefsExist(tx, input))) {
      return {
        skip: { ok: false, status: 400, error: "The section or a competence no longer exists" },
      };
    }
    const { id } = await tx.sectionModule.create({
      data: {
        ...moduleData(input),
        secondaryCompetences: {
          create: input.secondaryCompetenceIds.map((competenceId) => ({ competenceId })),
        },
      },
      select: { id: true },
    });
    return { id, action: "created", result: { ok: true, id } };
  });
}

/**
 * Saves an edit, the secondary competences replaced as a whole. Moving a
 * module to another section or changing its level also changes how past
 * attempts read under "See results by section", which is recalculated from
 * the current structure; the editor says so.
 */
export function updateModule(actor: Actor, id: string, input: ModuleInput): Promise<WriteResult> {
  return logged<WriteResult>(
    actor,
    "module",
    async (tx) => {
      const existing = await tx.sectionModule.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return { skip: { ok: false, status: 404, error: "Unknown module" } };
      if (!(await moduleRefsExist(tx, input))) {
        return {
          skip: { ok: false, status: 400, error: "The section or a competence no longer exists" },
        };
      }
      await tx.sectionModule.update({ where: { id }, data: moduleData(input) });
      await tx.sectionModuleSecondaryCompetence.deleteMany({ where: { moduleId: id } });
      await tx.sectionModuleSecondaryCompetence.createMany({
        data: input.secondaryCompetenceIds.map((competenceId) => ({ moduleId: id, competenceId })),
      });
      return { id, action: "edited", result: { ok: true, id } };
    },
    id,
  );
}

/**
 * Removes a module. One without questions is deleted; one with questions is
 * retired, so they're no longer asked but past results keep them, and it can
 * be restored with them.
 */
export function removeModule(actor: Actor, id: string): Promise<Removal> {
  return logged<Removal>(
    actor,
    "module",
    async (tx) => {
      const module = await tx.sectionModule.findUnique({
        where: { id },
        select: { _count: { select: { questions: true } } },
      });
      if (!module) return { skip: null };
      if (module._count.questions === 0) {
        await tx.sectionModule.delete({ where: { id } });
        return { id, action: "deleted", result: "deleted" };
      }
      await tx.sectionModule.update({ where: { id }, data: { retiredAt: new Date() } });
      return { id, action: "retired", result: "retired" };
    },
    id,
  );
}

export function restoreModule(actor: Actor, id: string): Promise<boolean> {
  return logged<boolean>(
    actor,
    "module",
    async (tx) => {
      const { count } = await tx.sectionModule.updateMany({
        where: { id },
        data: { retiredAt: null },
      });
      return count > 0 ? { id, action: "restored", result: true } : { skip: false };
    },
    id,
  );
}

// --- Learning journeys (phase 3) ---

/** Whether every section and source a journey points at exists. */
async function journeyRefsExist(tx: Tx, input: JourneyInput) {
  const sourceIds = [...new Set(input.steps.flatMap((s) => (s.sourceId ? [s.sourceId] : [])))];
  const [sections, sources] = await Promise.all([
    tx.section.count({ where: { id: { in: input.sections.map((s) => s.sectionId) } } }),
    tx.source.count({ where: { id: { in: sourceIds } } }),
  ]);
  return sections === input.sections.length && sources === sourceIds.length;
}

const journeyDetails = (input: JourneyInput) => ({
  name: input.name,
  description: input.description,
  moodleUrl: input.moodleUrl,
});

const stepData = (step: JourneyInput["steps"][number], order: number) => ({
  order,
  title: step.title,
  description: step.description,
  sourceId: step.sourceId,
});

export function createJourney(actor: Actor, input: JourneyInput): Promise<WriteResult> {
  return logged<WriteResult>(actor, "journey", async (tx) => {
    if (!(await journeyRefsExist(tx, input))) {
      return { skip: { ok: false, status: 400, error: "A section or source no longer exists" } };
    }
    const { id } = await tx.learningJourney.create({
      data: {
        ...journeyDetails(input),
        sections: { create: input.sections },
        modules: { create: input.steps.map((step, i) => stepData(step, i + 1)) },
      },
      select: { id: true },
    });
    return { id, action: "created", result: { ok: true, id } };
  });
}

/**
 * Saves an edit: the details, the section coverage (replaced as a whole) and
 * the steps. Existing steps keep their ids and are updated in place; new ones
 * are added and ones left out are deleted. Coverage decides what the journey
 * is recommended for and which sections assessing it asks about, from the
 * next recommendation on.
 */
export function updateJourney(actor: Actor, id: string, input: JourneyInput): Promise<WriteResult> {
  return logged<WriteResult>(
    actor,
    "journey",
    async (tx) => {
      const existing = await tx.learningJourney.findUnique({
        where: { id },
        select: { modules: { select: { id: true } } },
      });
      if (!existing) return { skip: { ok: false, status: 404, error: "Unknown journey" } };
      if (!(await journeyRefsExist(tx, input))) {
        return { skip: { ok: false, status: 400, error: "A section or source no longer exists" } };
      }

      const existingIds = new Set(existing.modules.map((m) => m.id));
      const keptIds = new Set(
        input.steps.flatMap((s) => (s.id && existingIds.has(s.id) ? [s.id] : [])),
      );
      await tx.learningJourney.update({ where: { id }, data: journeyDetails(input) });
      await tx.journeySection.deleteMany({ where: { journeyId: id } });
      await tx.journeySection.createMany({
        data: input.sections.map((s) => ({ journeyId: id, ...s })),
      });
      await tx.learningModule.deleteMany({ where: { journeyId: id, id: { notIn: [...keptIds] } } });
      for (const [i, step] of input.steps.entries()) {
        if (step.id && keptIds.has(step.id)) {
          await tx.learningModule.update({ where: { id: step.id }, data: stepData(step, i + 1) });
        } else {
          await tx.learningModule.create({ data: { journeyId: id, ...stepData(step, i + 1) } });
        }
      }
      return { id, action: "edited", result: { ok: true, id } };
    },
    id,
  );
}

/**
 * Removes a journey. One nothing refers to is deleted, with its coverage and
 * steps; one that's been recommended, picked by the AI advisor, assessed or
 * completed is retired, so past advice, history and the recommendation log
 * keep it, and it can be restored.
 */
export function removeJourney(actor: Actor, id: string): Promise<Removal> {
  return logged<Removal>(
    actor,
    "journey",
    async (tx) => {
      const journey = await tx.learningJourney.findUnique({
        where: { id },
        select: {
          _count: {
            select: {
              recommendations: true,
              chosenInAdvice: true,
              runnerUpInAdvice: true,
              satInstances: true,
              assessedIn: true,
            },
          },
        },
      });
      if (!journey) return { skip: null };
      if (Object.values(journey._count).every((n) => n === 0)) {
        await tx.learningJourney.delete({ where: { id } });
        return { id, action: "deleted", result: "deleted" };
      }
      await tx.learningJourney.update({ where: { id }, data: { retiredAt: new Date() } });
      return { id, action: "retired", result: "retired" };
    },
    id,
  );
}

export function restoreJourney(actor: Actor, id: string): Promise<boolean> {
  return logged<boolean>(
    actor,
    "journey",
    async (tx) => {
      const { count } = await tx.learningJourney.updateMany({
        where: { id },
        data: { retiredAt: null },
      });
      return count > 0 ? { id, action: "restored", result: true } : { skip: false };
    },
    id,
  );
}

import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { buildPieContent } from "../assessment/assessment.pie";
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
// one, so what's changed here stays changed.

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
  const [sections, competences, questions, journeys, sources] = await Promise.all([
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
  ]);

  return {
    sections: sections.map(({ _count, modules, ...section }) => ({
      ...section,
      /** Journeys covering it: a section anything points at is retired, not deleted. */
      journeyCount: _count.journeySections,
      /** Whether learners have been assessed with it in scope (a reassessment limited to it). */
      usedInAssessments: _count.satInstances > 0,
      modules: modules.map(({ _count: moduleCount, secondaryCompetences, ...module }) => ({
        ...module,
        secondaryCompetenceIds: secondaryCompetences.map((c) => c.competenceId),
        questionCount: moduleCount.questions,
      })),
    })),
    competences: competences.map(({ _count, ...competence }) => ({
      ...competence,
      questionCount: _count.questions,
      moduleCount: _count.mainForModules,
    })),
    questions: questions.map(toQuestionSummary),
    journeys: journeys.map(({ _count, modules, ...journey }) => ({
      ...journey,
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

/** Whether the module and competence a question points at exist. */
async function placementExists(input: QuestionInput) {
  const [module, competence] = await Promise.all([
    prisma.sectionModule.findUnique({ where: { id: input.sectionModuleId }, select: { id: true } }),
    prisma.competence.findUnique({ where: { id: input.competenceId }, select: { id: true } }),
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

export async function createQuestion(input: QuestionInput): Promise<SaveResult> {
  if (!(await placementExists(input))) {
    return { ok: false, status: 400, error: "The module or competence no longer exists" };
  }
  const question = await prisma.question.create({
    data: questionData(input),
    select: { id: true },
  });
  return { ok: true, id: question.id };
}

/**
 * Saves an edit. A question learners have answered keeps its type: their saved
 * answers are in that type's shape, so a different type means retiring it and
 * adding a new question. Answers already saved keep the score they got.
 */
export async function updateQuestion(id: string, input: QuestionInput): Promise<SaveResult> {
  const existing = await prisma.question.findUnique({
    where: { id },
    select: { questionType: true, _count: { select: { responses: true } } },
  });
  if (!existing) return { ok: false, status: 404, error: "Unknown question" };
  if (existing._count.responses > 0 && existing.questionType !== input.questionType) {
    return {
      ok: false,
      status: 409,
      error:
        "Learners have answered this question, so its type can't change. Remove it and add a new question instead.",
    };
  }
  if (!(await placementExists(input))) {
    return { ok: false, status: 400, error: "The module or competence no longer exists" };
  }
  await prisma.question.update({ where: { id }, data: questionData(input) });
  return { ok: true, id };
}

/**
 * Removes a question. One nobody has answered is deleted; one with answers is
 * retired instead, so past answers and results still have it to point at, and
 * it can be restored. Null when the question doesn't exist.
 */
export async function removeQuestion(id: string): Promise<"deleted" | "retired" | null> {
  const question = await prisma.question.findUnique({
    where: { id },
    select: { _count: { select: { responses: true } } },
  });
  if (!question) return null;
  if (question._count.responses === 0) {
    await prisma.question.delete({ where: { id } });
    return "deleted";
  }
  await prisma.question.update({ where: { id }, data: { retiredAt: new Date() } });
  return "retired";
}

/** Brings a retired question back into the assessment. False when it doesn't exist. */
export async function restoreQuestion(id: string): Promise<boolean> {
  const { count } = await prisma.question.updateMany({ where: { id }, data: { retiredAt: null } });
  return count > 0;
}

export async function createCompetence(input: CompetenceInput) {
  return prisma.competence.create({
    data: input,
    select: { id: true, name: true, description: true },
  });
}

/** Renames / re-describes a competence. Null when it doesn't exist. */
export async function updateCompetence(id: string, input: CompetenceInput) {
  const { count } = await prisma.competence.updateMany({ where: { id }, data: input });
  if (count === 0) return null;
  return prisma.competence.findUnique({
    where: { id },
    select: { id: true, name: true, description: true },
  });
}

// --- Sections and section modules (phase 2) ---

export type WriteResult =
  { ok: true; id: string } | { ok: false; status: 400 | 404; error: string };

export async function createSection(input: SectionInput): Promise<WriteResult> {
  const section = await prisma.section.create({ data: input, select: { id: true } });
  return { ok: true, id: section.id };
}

export async function updateSection(id: string, input: SectionInput): Promise<WriteResult> {
  const { count } = await prisma.section.updateMany({ where: { id }, data: input });
  if (count === 0) return { ok: false, status: 404, error: "Unknown section" };
  return { ok: true, id };
}

/**
 * Removes a section. An empty one (no modules, no journey covering it, never
 * a reassessment's scope) is deleted; any other is retired, so nothing it's
 * part of is lost and it can be restored. Retiring hides it, and everything
 * in it, from the assessment, recommendations and the Competencies tab.
 */
export async function removeSection(id: string): Promise<"deleted" | "retired" | null> {
  const section = await prisma.section.findUnique({
    where: { id },
    select: { _count: { select: { modules: true, journeySections: true, satInstances: true } } },
  });
  if (!section) return null;
  const { modules, journeySections, satInstances } = section._count;
  if (modules + journeySections + satInstances === 0) {
    await prisma.section.delete({ where: { id } });
    return "deleted";
  }
  await prisma.section.update({ where: { id }, data: { retiredAt: new Date() } });
  return "retired";
}

export async function restoreSection(id: string): Promise<boolean> {
  const { count } = await prisma.section.updateMany({ where: { id }, data: { retiredAt: null } });
  return count > 0;
}

/** Whether the section and every competence a module points at exist. */
async function moduleRefsExist(input: ModuleInput) {
  const competenceIds = [input.mainCompetenceId, ...input.secondaryCompetenceIds];
  const [section, competences] = await Promise.all([
    prisma.section.findUnique({ where: { id: input.sectionId }, select: { id: true } }),
    prisma.competence.count({ where: { id: { in: competenceIds } } }),
  ]);
  return section !== null && competences === competenceIds.length;
}

function moduleData({ secondaryCompetenceIds: _secondary, ...input }: ModuleInput) {
  return input;
}

export async function createModule(input: ModuleInput): Promise<WriteResult> {
  if (!(await moduleRefsExist(input))) {
    return { ok: false, status: 400, error: "The section or a competence no longer exists" };
  }
  const module = await prisma.sectionModule.create({
    data: {
      ...moduleData(input),
      secondaryCompetences: {
        create: input.secondaryCompetenceIds.map((competenceId) => ({ competenceId })),
      },
    },
    select: { id: true },
  });
  return { ok: true, id: module.id };
}

/**
 * Saves an edit, the secondary competences replaced as a whole. Moving a
 * module to another section or changing its level also changes how past
 * attempts read under "See results by section", which is recalculated from
 * the current structure; the editor says so.
 */
export async function updateModule(id: string, input: ModuleInput): Promise<WriteResult> {
  const existing = await prisma.sectionModule.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, status: 404, error: "Unknown module" };
  if (!(await moduleRefsExist(input))) {
    return { ok: false, status: 400, error: "The section or a competence no longer exists" };
  }
  await prisma.$transaction([
    prisma.sectionModule.update({ where: { id }, data: moduleData(input) }),
    prisma.sectionModuleSecondaryCompetence.deleteMany({ where: { moduleId: id } }),
    prisma.sectionModuleSecondaryCompetence.createMany({
      data: input.secondaryCompetenceIds.map((competenceId) => ({ moduleId: id, competenceId })),
    }),
  ]);
  return { ok: true, id };
}

/**
 * Removes a module. One without questions is deleted; one with questions is
 * retired, so they're no longer asked but past results keep them, and it can
 * be restored with them.
 */
export async function removeModule(id: string): Promise<"deleted" | "retired" | null> {
  const module = await prisma.sectionModule.findUnique({
    where: { id },
    select: { _count: { select: { questions: true } } },
  });
  if (!module) return null;
  if (module._count.questions === 0) {
    await prisma.sectionModule.delete({ where: { id } });
    return "deleted";
  }
  await prisma.sectionModule.update({ where: { id }, data: { retiredAt: new Date() } });
  return "retired";
}

export async function restoreModule(id: string): Promise<boolean> {
  const { count } = await prisma.sectionModule.updateMany({
    where: { id },
    data: { retiredAt: null },
  });
  return count > 0;
}

// --- Learning journeys (phase 3) ---

/** Whether every section and source a journey points at exists. */
async function journeyRefsExist(input: JourneyInput) {
  const sourceIds = [...new Set(input.steps.flatMap((s) => (s.sourceId ? [s.sourceId] : [])))];
  const [sections, sources] = await Promise.all([
    prisma.section.count({ where: { id: { in: input.sections.map((s) => s.sectionId) } } }),
    prisma.source.count({ where: { id: { in: sourceIds } } }),
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

export async function createJourney(input: JourneyInput): Promise<WriteResult> {
  if (!(await journeyRefsExist(input))) {
    return { ok: false, status: 400, error: "A section or source no longer exists" };
  }
  const journey = await prisma.learningJourney.create({
    data: {
      ...journeyDetails(input),
      sections: { create: input.sections },
      modules: { create: input.steps.map((step, i) => stepData(step, i + 1)) },
    },
    select: { id: true },
  });
  return { ok: true, id: journey.id };
}

/**
 * Saves an edit in one transaction: the details, the section coverage
 * (replaced as a whole) and the steps. Existing steps keep their ids and are
 * updated in place; new ones are added and ones left out are deleted.
 * Coverage decides what the journey is recommended for and which sections
 * assessing it asks about, from the next recommendation on.
 */
export async function updateJourney(id: string, input: JourneyInput): Promise<WriteResult> {
  const existing = await prisma.learningJourney.findUnique({
    where: { id },
    select: { modules: { select: { id: true } } },
  });
  if (!existing) return { ok: false, status: 404, error: "Unknown journey" };
  if (!(await journeyRefsExist(input))) {
    return { ok: false, status: 400, error: "A section or source no longer exists" };
  }

  const existingIds = new Set(existing.modules.map((m) => m.id));
  const keptIds = new Set(
    input.steps.flatMap((s) => (s.id && existingIds.has(s.id) ? [s.id] : [])),
  );
  await prisma.$transaction([
    prisma.learningJourney.update({ where: { id }, data: journeyDetails(input) }),
    prisma.journeySection.deleteMany({ where: { journeyId: id } }),
    prisma.journeySection.createMany({
      data: input.sections.map((s) => ({ journeyId: id, ...s })),
    }),
    prisma.learningModule.deleteMany({ where: { journeyId: id, id: { notIn: [...keptIds] } } }),
    ...input.steps.map((step, i) =>
      step.id && keptIds.has(step.id)
        ? prisma.learningModule.update({ where: { id: step.id }, data: stepData(step, i + 1) })
        : prisma.learningModule.create({ data: { journeyId: id, ...stepData(step, i + 1) } }),
    ),
  ]);
  return { ok: true, id };
}

/**
 * Removes a journey. One nothing refers to is deleted, with its coverage and
 * steps; one that's been recommended, picked by the AI advisor, assessed or
 * completed is retired, so past advice, history and the recommendation log
 * keep it, and it can be restored.
 */
export async function removeJourney(id: string): Promise<"deleted" | "retired" | null> {
  const journey = await prisma.learningJourney.findUnique({
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
  if (!journey) return null;
  if (Object.values(journey._count).every((n) => n === 0)) {
    await prisma.learningJourney.delete({ where: { id } });
    return "deleted";
  }
  await prisma.learningJourney.update({ where: { id }, data: { retiredAt: new Date() } });
  return "retired";
}

export async function restoreJourney(id: string): Promise<boolean> {
  const { count } = await prisma.learningJourney.updateMany({
    where: { id },
    data: { retiredAt: null },
  });
  return count > 0;
}

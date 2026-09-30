import { Prisma, type Question } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { findLearnerById, getRoleGrants } from "../identity/identity.service";
import { ORDERED_QUESTION_TYPES } from "./assessment.pie";
import {
  extractDragAndDropBlanks,
  extractMultipleChoiceValues,
  IDK_VALUE,
  scoreDragAndDrop,
  scoreLikert,
  scoreMultipleChoice,
  type ScoreResult,
} from "./assessment.scoring";

// All Prisma access for assessment_* tables lives here.

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Randomizes the on-screen order of a question's answer choices (Fisher–
 * Yates) so "it's always the 2nd option" never becomes a shortcut. Each
 * choice keeps its own value/id and correct flag, so this has no effect on
 * scoring (assessment.scoring.ts looks choices up by value/id, never by
 * position) — but ordered scales (likert) and true/false are left alone,
 * since their order is the point, not noise to shuffle. The "I don't know"
 * choice every question carries (IDK_VALUE) is never shuffled in among the
 * others either — it's held back and always placed last.
 */
function withShuffledChoices<T extends Pick<Question, "questionType" | "content">>(question: T): T {
  if (ORDERED_QUESTION_TYPES.includes(question.questionType)) return question;

  const content = question.content as { models?: { choices?: { value?: unknown }[] }[] } | null;
  const models = content?.models;
  const firstModel = models?.[0];
  if (!content || !models || !firstModel?.choices) return question;

  const idk = firstModel.choices.filter((c) => c.value === IDK_VALUE);
  const rest = firstModel.choices.filter((c) => c.value !== IDK_VALUE);
  const shuffledModels = [
    { ...firstModel, choices: [...shuffle(rest), ...idk] },
    ...models.slice(1),
  ];
  return { ...question, content: { ...content, models: shuffledModels } as Prisma.JsonValue };
}

/** Whether this learner has never finished a SAT instance — their initial assessment is still ahead of them. */
async function isInitialAssessment(learnerId: string): Promise<boolean> {
  const completedCount = await prisma.satInstance.count({
    where: { learnerId, completedAt: { not: null } },
  });
  return completedCount === 0;
}

/**
 * Which questions this learner may currently see. Everyone gets the whole
 * bank for their initial assessment (every section, every competence) —
 * that's the point of it — regardless of role. Once they've completed at
 * least one instance, later runs go back to the normal role allow-lists:
 * those whose competence has been granted to the role, OR whose module sits
 * in a section granted to the role (identity_role_competence /
 * identity_role_section). A role with no grants then sees nothing. Returns
 * null for a learner with no role at all — they can't take anything yet.
 */
async function visibleQuestionFilter(learnerId: string): Promise<Prisma.QuestionWhereInput | null> {
  const learner = await findLearnerById(learnerId);
  if (!learner?.roleId) return null;

  if (await isInitialAssessment(learnerId)) return {};

  const { sectionIds, competenceIds } = await getRoleGrants(learner.roleId);
  return {
    OR: [
      { competenceId: { in: competenceIds } },
      { sectionModule: { sectionId: { in: sectionIds } } },
    ],
  };
}

/** The questions the learner's role can see, in a stable section → module → question order. */
export async function listQuestions(learnerId: string) {
  const where = await visibleQuestionFilter(learnerId);
  if (!where) return [];

  const questions = await prisma.question.findMany({
    where,
    include: { competence: { select: { id: true, name: true } } },
    orderBy: [
      { sectionModule: { section: { name: "asc" } } },
      { sectionModule: { name: "asc" } },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  return questions.map((q) =>
    withShuffledChoices({
      id: q.id,
      prompt: q.prompt,
      questionType: q.questionType,
      content: q.content,
      competence: q.competence,
    }),
  );
}

/**
 * Shape of the PIE `content` this module stores — narrowed just enough to
 * score it. See assessment.scoring.ts for the caveat on the actual session
 * (`answer`) shapes assumed here.
 */
type PieModel = {
  id?: string;
  choiceMode?: "radio" | "checkbox";
  choices?: { value?: string; correct?: boolean }[];
  correctResponse?: Record<string, string>;
};

/**
 * Scores one answer against its question. `answer` is the frontend's
 * PieAnswer wrapper (`{ session, complete }` — see PieQuestionPlayer), not
 * the raw PIE session itself; the session lives at `answer.session`.
 */
function scoreAnswer(
  question: Pick<Question, "questionType" | "content">,
  answer: unknown,
): ScoreResult | null {
  const model = (question.content as { models?: PieModel[] } | null)?.models?.[0];
  if (!model) return null;
  const modelId = model.id ?? "1"; // every question this module stores has exactly one model, id "1"
  const session = (answer as { session?: unknown } | null)?.session;

  if (question.questionType === "drag_and_drop" && model.correctResponse) {
    return scoreDragAndDrop(model.correctResponse, extractDragAndDropBlanks(session, modelId));
  }

  if (!model.choices) return null;

  const selected = extractMultipleChoiceValues(session, modelId);

  // "I don't know" always zeroes the whole question out — even on a
  // multi_choice where other boxes were also ticked — rather than scoring it
  // as a wrong guess.
  if (selected.includes(IDK_VALUE)) return { score: 0, maxScore: 0 };

  if (question.questionType === "likert") {
    const values = model.choices.map((c) => String(c.value));
    return scoreLikert(values, selected);
  }

  if (model.choiceMode) {
    const choices = model.choices.map((c) => ({
      value: String(c.value),
      correct: Boolean(c.correct),
    }));
    return scoreMultipleChoice(choices, model.choiceMode, selected);
  }

  return null;
}

/** The learner's current unfinished SAT instance, if any — not created here. */
function findActiveInstance(learnerId: string) {
  return prisma.satInstance.findFirst({
    where: { learnerId, completedAt: null },
    orderBy: { startedAt: "desc" },
  });
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function getOrCreateActiveInstance(learnerId: string) {
  const active = await findActiveInstance(learnerId);
  if (active) return active;

  const latest = await prisma.satInstance.findFirst({
    where: { learnerId },
    orderBy: { instanceNum: "desc" },
    select: { instanceNum: true },
  });

  try {
    return await prisma.satInstance.create({
      data: { learnerId, instanceNum: (latest?.instanceNum ?? 0) + 1 },
    });
  } catch (err) {
    // Two first answers arrived at once and the other request created the
    // instance first (unique on learnerId + instanceNum) — use theirs.
    if (isUniqueViolation(err)) {
      const created = await findActiveInstance(learnerId);
      if (created) return created;
    }
    throw err;
  }
}

/**
 * Save/resume (CD-7 / SAT2): the learner's in-progress instance plus every
 * answer saved so far, so the frontend can restore exactly where they left
 * off. Returns null if they haven't started (or have only completed
 * instances) — a fresh start, not an error.
 */
export async function getProgress(learnerId: string) {
  const active = await findActiveInstance(learnerId);
  if (!active) return null;

  const responses = await prisma.response.findMany({
    where: { satInstanceId: active.id },
  });

  return {
    satInstanceId: active.id,
    responses: responses.map((r) => ({ questionId: r.questionId, answer: r.answer })),
  };
}

/**
 * Upserts one answer against the learner's active instance, creating the
 * instance on the first call, and scores it against the question. An atomic
 * upsert on (satInstanceId, questionId), so two saves arriving together
 * can't collide on the unique constraint.
 *
 * Returns null — and saves nothing — when the question doesn't exist or
 * isn't one the learner's role may see: a learner can only answer the
 * questions listQuestions would have given them. Checked before the
 * instance is created, so a bad id never leaves an empty instance behind.
 */
export async function saveResponse(
  learnerId: string,
  questionId: string,
  answer: Prisma.InputJsonValue,
) {
  const visible = await visibleQuestionFilter(learnerId);
  if (!visible) return null;

  const question = await prisma.question.findFirst({
    where: { AND: [{ id: questionId }, visible] },
  });
  if (!question) return null;

  const instance = await getOrCreateActiveInstance(learnerId);
  const result = scoreAnswer(question, answer);
  const data = { answer, score: result?.score ?? null, maxScore: result?.maxScore ?? null };

  return prisma.response.upsert({
    where: { satInstanceId_questionId: { satInstanceId: instance.id, questionId } },
    update: data,
    create: { satInstanceId: instance.id, questionId, ...data },
  });
}

/**
 * Marks the learner's active instance complete and rolls its scored
 * responses up into one CompetenceScore row per competence touched — grouped
 * by each question's own competenceId, independent of the section/module
 * hierarchy. Unscored responses are excluded. No-ops if there isn't an
 * active instance.
 */
export async function completeActiveInstance(learnerId: string) {
  const active = await findActiveInstance(learnerId);
  if (!active) return null;

  const responses = await prisma.response.findMany({
    where: { satInstanceId: active.id, score: { not: null } },
    include: { question: { select: { competenceId: true } } },
  });

  const byCompetence = new Map<string, { score: number; maxScore: number }>();
  for (const r of responses) {
    const competenceId = r.question.competenceId;
    const totals = byCompetence.get(competenceId) ?? { score: 0, maxScore: 0 };
    totals.score += r.score ?? 0;
    totals.maxScore += r.maxScore ?? 0;
    byCompetence.set(competenceId, totals);
  }

  await prisma.$transaction([
    prisma.satInstance.update({ where: { id: active.id }, data: { completedAt: new Date() } }),
    ...Array.from(byCompetence.entries()).map(([competenceId, totals]) =>
      prisma.competenceScore.upsert({
        where: { satInstanceId_competenceId: { satInstanceId: active.id, competenceId } },
        update: totals,
        create: { satInstanceId: active.id, competenceId, ...totals },
      }),
    ),
  ]);

  return active;
}

export function getCompetenceScores(satInstanceId: string) {
  return prisma.competenceScore.findMany({
    where: { satInstanceId },
    include: { competence: { select: { name: true } } },
  });
}

/**
 * The learner's most recently completed SAT instance's competence scores —
 * one entry per competence actually scored in that instance, sorted by name
 * for a stable axis order. Deliberately not filtered by the learner's
 * *current* role: an initial assessment covers every competence regardless
 * of role, and a later retake's own CompetenceScore rows already reflect
 * whatever was visible when it was taken — re-applying today's role filter
 * here could hide a competence the learner was genuinely just scored on
 * (e.g. after a role change since that run).
 */
export async function getLatestCompetenceScores(learnerId: string) {
  const latest = await prisma.satInstance.findFirst({
    where: { learnerId, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
  });
  if (!latest) return [];

  const scores = await getCompetenceScores(latest.id);
  return scores
    .map((s) => ({ competence: { name: s.competence.name }, score: s.score, maxScore: s.maxScore }))
    .sort((a, b) => a.competence.name.localeCompare(b.competence.name));
}

/**
 * Every completed SAT instance for a learner, oldest first, with a summed
 * score and the per-area breakdown — so a History page can show how they've
 * progressed over retakes (CD-21). Unlike getLatestCompetenceScores, this
 * only lists the areas actually covered by that specific instance (no
 * padding to every area in the bank) — if a role change ever narrows which
 * questions a learner sees, this naturally shows exactly what that
 * instance tested, without needing to know why.
 */
export async function getSatHistory(learnerId: string) {
  const instances = await prisma.satInstance.findMany({
    where: { learnerId, completedAt: { not: null } },
    orderBy: { instanceNum: "asc" },
    include: {
      competenceScores: {
        include: { competence: { select: { name: true } } },
        orderBy: { competence: { name: "asc" } },
      },
    },
  });

  return instances.map((instance) => {
    const areas = instance.competenceScores.map((s) => ({
      name: s.competence.name,
      score: s.score,
      maxScore: s.maxScore,
    }));

    return {
      instanceNum: instance.instanceNum,
      completedAt: instance.completedAt,
      sumScore: areas.reduce((sum, a) => sum + a.score, 0),
      sumMaxScore: areas.reduce((sum, a) => sum + a.maxScore, 0),
      areas,
    };
  });
}

/**
 * The latest completed SAT's scores broken down per section: for each section
 * the learner was actually assessed in, one entry per competence its modules
 * cover (main or secondary) or its visible questions name, whether or not it
 * was scored there (0/0 if not). Sections with no scored answers in the
 * instance are left out entirely. Scores are grouped by each question's own section and
 * competence, so a competence appearing in several sections is scored
 * separately in each. Deliberately not filtered by the learner's *current*
 * role — see the note on getLatestCompetenceScores above; the same reasoning
 * applies here.
 */
export async function getLatestSectionCompetenceScores(learnerId: string) {
  const latest = await prisma.satInstance.findFirst({
    where: { learnerId, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
  });
  if (!latest) return [];

  const responses = await prisma.response.findMany({
    where: { satInstanceId: latest.id, maxScore: { gt: 0 } },
    select: {
      score: true,
      maxScore: true,
      question: { select: { competenceId: true, sectionModule: { select: { sectionId: true } } } },
    },
  });

  const totals = new Map<string, { score: number; maxScore: number }>(); // "sectionId:competenceId"
  const assessedSectionIds = new Set<string>();
  for (const r of responses) {
    const sectionId = r.question.sectionModule.sectionId;
    const key = `${sectionId}:${r.question.competenceId}`;
    const entry = totals.get(key) ?? { score: 0, maxScore: 0 };
    entry.score += r.score ?? 0;
    entry.maxScore += r.maxScore ?? 0;
    totals.set(key, entry);
    assessedSectionIds.add(sectionId);
  }

  // A section's axes are every competence its modules cover (main or
  // secondary) plus any a question in it names — whether or not it was scored.
  const modules = await prisma.sectionModule.findMany({
    where: { sectionId: { in: [...assessedSectionIds] } },
    select: {
      section: { select: { id: true, name: true } },
      mainCompetence: { select: { id: true, name: true } },
      secondaryCompetences: { select: { competence: { select: { id: true, name: true } } } },
      questions: { select: { competence: { select: { id: true, name: true } } } },
    },
  });

  const sections = new Map<
    string,
    { section: { id: string; name: string }; competences: Map<string, string> }
  >();
  for (const m of modules) {
    const entry = sections.get(m.section.id) ?? { section: m.section, competences: new Map() };
    const covered = [
      m.mainCompetence,
      ...m.secondaryCompetences.map((c) => c.competence),
      ...m.questions.map((q) => q.competence),
    ];
    for (const c of covered) entry.competences.set(c.id, c.name);
    sections.set(m.section.id, entry);
  }

  return Array.from(sections.values())
    .sort((a, b) => a.section.name.localeCompare(b.section.name))
    .map(({ section, competences }) => ({
      section,
      competences: Array.from(competences.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([competenceId, name]) => ({
          competence: { name },
          score: totals.get(`${section.id}:${competenceId}`)?.score ?? 0,
          maxScore: totals.get(`${section.id}:${competenceId}`)?.maxScore ?? 0,
        })),
    }));
}

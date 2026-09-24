import { Prisma, type Question } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { findLearnerById, getRoleGrants } from "../identity/identity.service";
import { ORDERED_QUESTION_TYPES } from "./assessment.pie";
import {
  extractDragAndDropBlanks,
  extractMultipleChoiceValues,
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
 * since their order is the point, not noise to shuffle.
 */
function withShuffledChoices<T extends Pick<Question, "questionType" | "content">>(question: T): T {
  if (ORDERED_QUESTION_TYPES.includes(question.questionType)) return question;

  const content = question.content as { models?: { choices?: unknown[] }[] } | null;
  const models = content?.models;
  const firstModel = models?.[0];
  if (!content || !models || !firstModel?.choices) return question;

  const shuffledModels = [
    { ...firstModel, choices: shuffle(firstModel.choices) },
    ...models.slice(1),
  ];
  return { ...question, content: { ...content, models: shuffledModels } as Prisma.JsonValue };
}

/**
 * Which questions this learner's role may see: those whose competence has
 * been granted to the role, OR whose module sits in a section granted to the
 * role (identity_role_competence / identity_role_section). A role with no
 * grants sees nothing. Returns null for a learner with no role at all.
 */
async function visibleQuestionFilter(learnerId: string): Promise<Prisma.QuestionWhereInput | null> {
  const learner = await findLearnerById(learnerId);
  if (!learner?.roleId) return null;

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

  if (question.questionType === "likert") {
    const values = model.choices.map((c) => String(c.value));
    return scoreLikert(values, extractMultipleChoiceValues(session, modelId));
  }

  if (model.choiceMode) {
    const choices = model.choices.map((c) => ({
      value: String(c.value),
      correct: Boolean(c.correct),
    }));
    return scoreMultipleChoice(
      choices,
      model.choiceMode,
      extractMultipleChoiceValues(session, modelId),
    );
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
 */
export async function saveResponse(
  learnerId: string,
  questionId: string,
  answer: Prisma.InputJsonValue,
) {
  const instance = await getOrCreateActiveInstance(learnerId);
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) throw new Error(`Question not found: ${questionId}`);

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
 * one entry per competence their role can see a question for, in a stable
 * order, so the radar keeps the same axes after every retake. Competences
 * with no scored answers in that instance come back as 0/0.
 */
export async function getLatestCompetenceScores(learnerId: string) {
  const latest = await prisma.satInstance.findFirst({
    where: { learnerId, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
  });
  if (!latest) return [];

  const where = await visibleQuestionFilter(learnerId);
  if (!where) return [];

  const [competences, scores] = await Promise.all([
    prisma.competence.findMany({
      where: { questions: { some: where } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getCompetenceScores(latest.id),
  ]);
  const scoreByCompetence = new Map(scores.map((s) => [s.competenceId, s]));

  return competences.map((competence) => ({
    competence: { name: competence.name },
    score: scoreByCompetence.get(competence.id)?.score ?? 0,
    maxScore: scoreByCompetence.get(competence.id)?.maxScore ?? 0,
  }));
}

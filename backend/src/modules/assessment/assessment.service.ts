import type { Prisma, Question } from "@prisma/client";
import { prisma } from "../../db/prisma";
import {
  extractDragAndDropBlanks,
  extractMultipleChoiceValues,
  scoreDragAndDrop,
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
 * position) — but self-rating comfort scales are left alone, since their
 * order (uncomfortable → comfortable) is the point, not noise to shuffle.
 */
function withShuffledChoices<T extends Pick<Question, "questionType" | "content">>(question: T): T {
  if (question.questionType === "self_rating") return question;

  const content = question.content as { models?: { choices?: unknown[] }[] } | null;
  const models = content?.models;
  const firstModel = models?.[0];
  if (!content || !models || !firstModel?.choices) return question;

  const shuffledModels = [{ ...firstModel, choices: shuffle(firstModel.choices) }, ...models.slice(1)];
  return { ...question, content: { ...content, models: shuffledModels } as Prisma.JsonValue };
}

export async function listQuestions() {
  const questions = await prisma.question.findMany({ include: { competenceArea: true } });
  return questions.map(withShuffledChoices);
}

/**
 * Shape of the PIE `content` this module seeds — narrowed just enough to
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
function scoreAnswer(question: Pick<Question, "questionType" | "content">, answer: unknown): ScoreResult | null {
  if (question.questionType === "self_rating") return null;

  const model = (question.content as { models?: PieModel[] } | null)?.models?.[0];
  if (!model) return null;
  const modelId = model.id ?? "1"; // every question this module seeds has exactly one model, id "1"
  const session = (answer as { session?: unknown } | null)?.session;

  if (question.questionType === "drag_and_drop" && model.correctResponse) {
    return scoreDragAndDrop(model.correctResponse, extractDragAndDropBlanks(session, modelId));
  }

  if (model.choices && model.choiceMode) {
    const choices = model.choices.map((c) => ({ value: String(c.value), correct: Boolean(c.correct) }));
    return scoreMultipleChoice(choices, model.choiceMode, extractMultipleChoiceValues(session, modelId));
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

async function getOrCreateActiveInstance(learnerId: string) {
  const active = await findActiveInstance(learnerId);
  if (active) return active;

  const priorCount = await prisma.satInstance.count({ where: { learnerId } });
  return prisma.satInstance.create({
    data: { learnerId, instanceNum: priorCount + 1 },
  });
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
 * instance on the first call, and scores it against the question.
 */
export async function saveResponse(learnerId: string, questionId: string, answer: Prisma.InputJsonValue) {
  const instance = await getOrCreateActiveInstance(learnerId);
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) throw new Error(`Question not found: ${questionId}`);

  const result = scoreAnswer(question, answer);
  const data = { answer, score: result?.score ?? null, maxScore: result?.maxScore ?? null };

  const existing = await prisma.response.findFirst({
    where: { satInstanceId: instance.id, questionId },
  });

  if (existing) {
    return prisma.response.update({ where: { id: existing.id }, data });
  }
  return prisma.response.create({
    data: { satInstanceId: instance.id, questionId, ...data },
  });
}

/**
 * Marks the learner's active instance complete and rolls its scored
 * responses up into one CompetenceScore row per competence area touched.
 * Self-rating (and any other unscored) responses are excluded — they have
 * no score to sum. No-ops if there isn't an active instance.
 */
export async function completeActiveInstance(learnerId: string) {
  const active = await findActiveInstance(learnerId);
  if (!active) return null;

  const responses = await prisma.response.findMany({
    where: { satInstanceId: active.id, score: { not: null } },
    include: { question: { select: { competenceAreaId: true } } },
  });

  const byArea = new Map<string, { score: number; maxScore: number }>();
  for (const r of responses) {
    const areaId = r.question.competenceAreaId;
    const totals = byArea.get(areaId) ?? { score: 0, maxScore: 0 };
    totals.score += r.score ?? 0;
    totals.maxScore += r.maxScore ?? 0;
    byArea.set(areaId, totals);
  }

  await prisma.$transaction([
    prisma.satInstance.update({ where: { id: active.id }, data: { completedAt: new Date() } }),
    ...Array.from(byArea.entries()).map(([competenceAreaId, totals]) =>
      prisma.competenceScore.upsert({
        where: { satInstanceId_competenceAreaId: { satInstanceId: active.id, competenceAreaId } },
        update: totals,
        create: { satInstanceId: active.id, competenceAreaId, ...totals },
      }),
    ),
  ]);

  return active;
}

export function getCompetenceScores(satInstanceId: string) {
  return prisma.competenceScore.findMany({
    where: { satInstanceId },
    include: { competenceArea: { select: { name: true } } },
  });
}

/** The learner's most recently completed SAT instance's competence scores. */
export async function getLatestCompetenceScores(learnerId: string) {
  const latest = await prisma.satInstance.findFirst({
    where: { learnerId, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
  });
  if (!latest) return [];
  return getCompetenceScores(latest.id);
}

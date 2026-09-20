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

export function findQuestionById(id: string) {
  return prisma.question.findUnique({ where: { id } });
}

export function findSatInstance(id: string) {
  return prisma.satInstance.findUnique({ where: { id } });
}

/** The learner's in-progress SAT instance, or a fresh one if none is open. */
export async function startSatInstance(learnerId: string) {
  const open = await prisma.satInstance.findFirst({
    where: { learnerId, completedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (open) return open;

  const priorCount = await prisma.satInstance.count({ where: { learnerId } });
  return prisma.satInstance.create({ data: { learnerId, instanceNum: priorCount + 1 } });
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

function scoreAnswer(question: Pick<Question, "questionType" | "content">, answer: unknown): ScoreResult | null {
  if (question.questionType === "self_rating") return null;

  const model = (question.content as { models?: PieModel[] } | null)?.models?.[0];
  if (!model) return null;
  const modelId = model.id ?? "1"; // every question this module seeds has exactly one model, id "1"

  if (question.questionType === "drag_and_drop" && model.correctResponse) {
    return scoreDragAndDrop(model.correctResponse, extractDragAndDropBlanks(answer, modelId));
  }

  if (model.choices && model.choiceMode) {
    const choices = model.choices.map((c) => ({ value: String(c.value), correct: Boolean(c.correct) }));
    return scoreMultipleChoice(choices, model.choiceMode, extractMultipleChoiceValues(answer, modelId));
  }

  return null;
}

/** Scores and persists one answer, replacing any prior answer to the same question in this instance. */
export function submitResponse(satInstanceId: string, question: Question, answer: unknown) {
  const result = scoreAnswer(question, answer);
  const data = {
    answer: answer as Prisma.InputJsonValue,
    score: result?.score ?? null,
    maxScore: result?.maxScore ?? null,
  };

  return prisma.response.upsert({
    where: { satInstanceId_questionId: { satInstanceId, questionId: question.id } },
    update: data,
    create: { satInstanceId, questionId: question.id, ...data },
  });
}

/**
 * Marks a SAT instance finished and rolls its scored responses up into one
 * CompetenceScore row per competence area touched. Self-rating (and any
 * other unscored) responses are excluded — they have no score to sum.
 */
export async function completeSatInstance(satInstanceId: string) {
  const responses = await prisma.response.findMany({
    where: { satInstanceId, score: { not: null } },
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
    prisma.satInstance.update({ where: { id: satInstanceId }, data: { completedAt: new Date() } }),
    ...Array.from(byArea.entries()).map(([competenceAreaId, totals]) =>
      prisma.competenceScore.upsert({
        where: { satInstanceId_competenceAreaId: { satInstanceId, competenceAreaId } },
        update: totals,
        create: { satInstanceId, competenceAreaId, ...totals },
      }),
    ),
  ]);

  return getCompetenceScores(satInstanceId);
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

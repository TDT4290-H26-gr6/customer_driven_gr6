import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";

// All Prisma access for assessment_* tables lives here.

export function listQuestions() {
  return prisma.question.findMany({ include: { competenceArea: true } });
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
 * instance on the first call. Grading (Response.score) isn't wired up yet —
 * that's separate work — so it's left null here.
 */
export async function saveResponse(
  learnerId: string,
  questionId: string,
  answer: Prisma.InputJsonValue,
) {
  const instance = await getOrCreateActiveInstance(learnerId);

  const existing = await prisma.response.findFirst({
    where: { satInstanceId: instance.id, questionId },
  });

  if (existing) {
    return prisma.response.update({ where: { id: existing.id }, data: { answer } });
  }
  return prisma.response.create({
    data: { satInstanceId: instance.id, questionId, answer },
  });
}

/** Marks the learner's active instance complete. No-ops if there isn't one. */
export async function completeActiveInstance(learnerId: string) {
  const active = await findActiveInstance(learnerId);
  if (!active) return null;

  return prisma.satInstance.update({
    where: { id: active.id },
    data: { completedAt: new Date() },
  });
}

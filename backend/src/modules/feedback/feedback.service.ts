import { prisma } from "../../db/prisma";
import type { FeedbackInput } from "./feedback.types";

// All Prisma access for feedback_* tables lives here.

export function createFeedback(learnerId: string, input: FeedbackInput) {
  return prisma.feedback.create({ data: { learnerId, ...input } });
}

/** Everything testers have sent, newest first, with who sent it. */
export function listFeedback() {
  return prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    include: { learner: { select: { email: true, name: true } } },
  });
}

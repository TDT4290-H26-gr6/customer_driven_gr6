import { prisma } from "../../db/prisma";

// All Prisma access for assessment_* tables lives here.

export function listQuestions() {
  return prisma.question.findMany({ include: { competenceArea: true } });
}

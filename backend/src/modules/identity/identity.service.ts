import { prisma } from "../../db/prisma";
import { ensureDefaultRoles } from "./roles.bootstrap";

// All Prisma access for identity_* tables lives here.

export function findLearnerById(id: string) {
  return prisma.learner.findUnique({ where: { id }, include: { userRole: true } });
}

export function upsertLearnerFromGoogle(sub: string, email: string, name?: string | null) {
  return prisma.learner.upsert({
    where: { googleSubId: sub },
    update: { email, name },
    create: { email, name, googleSubId: sub },
    include: { userRole: true },
  });
}

export async function listRoles() {
  if ((await prisma.role.count()) === 0) await ensureDefaultRoles();
  return prisma.role.findMany({ orderBy: { name: "asc" } });
}

export function findRole(id: string) {
  return prisma.role.findUnique({ where: { id } });
}

export function setLearnerRole(learnerId: string, roleId: string) {
  return prisma.learner.update({
    where: { id: learnerId },
    data: { roleId },
    include: { userRole: true },
  });
}

export function completeInitialAssessment(learnerId: string) {
  return prisma.learner.update({
    where: { id: learnerId },
    data: { hasCompletedInitialAssessment: true },
    include: { userRole: true },
  });
}

import { prisma } from "../../db/prisma";
import { ensureDefaultRoles } from "./roles.bootstrap";
import type { LearnerProfileInput } from "./identity.types";
import { deleteRecommendationsForLearner } from "../learningJourney/learningJourney.service";

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

export function getLearnerProfile(learnerId: string) {
  return prisma.learnerProfile.findUnique({ where: { learnerId } });
}

export function saveLearnerProfile(learnerId: string, data: LearnerProfileInput) {
  return prisma.learnerProfile.upsert({
    where: { learnerId },
    update: data,
    create: { learnerId, ...data },
  });
}

/**
 * GDPR account deletion (CD-60). SatInstance/Response/CompetenceScore and
 * LearnerProfile cascade at the DB level (onDelete: Cascade — see
 * assessment.prisma/identity.prisma). JourneyRecommendation doesn't: it
 * references learnerId as a plain field, not a real relation (see
 * learningJourney.prisma), so it's cleaned up explicitly through that
 * module's own service first.
 */
export async function deleteLearner(learnerId: string) {
  await deleteRecommendationsForLearner(learnerId);
  await prisma.learner.delete({ where: { id: learnerId } });
}

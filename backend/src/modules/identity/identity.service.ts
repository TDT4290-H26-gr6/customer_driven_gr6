import { prisma } from "../../db/prisma";
import type { LearnerProfileInput } from "./identity.types";

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

export function listRoles() {
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

// --- Role visibility allow-lists (identity_role_section / identity_role_competence) ---

/** What one role is allowed to see. Used by the assessment module to filter questions. */
export async function getRoleGrants(roleId: string) {
  const [sections, competences] = await Promise.all([
    prisma.roleSection.findMany({ where: { roleId }, select: { sectionId: true } }),
    prisma.roleCompetence.findMany({ where: { roleId }, select: { competenceId: true } }),
  ]);
  return {
    sectionIds: sections.map((s) => s.sectionId),
    competenceIds: competences.map((c) => c.competenceId),
  };
}

/**
 * Everything the admin screen needs in one read: every role, every section
 * and competence, and every grant. Sections and competences belong to the
 * assessment module — reading them here is the read-only cross-module access
 * context/backend-structure.md allows.
 */
export async function getVisibilityMatrix() {
  const [roles, sections, competences, roleSections, roleCompetences] = await Promise.all([
    prisma.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.section.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true },
    }),
    prisma.competence.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true },
    }),
    prisma.roleSection.findMany({ select: { roleId: true, sectionId: true } }),
    prisma.roleCompetence.findMany({ select: { roleId: true, competenceId: true } }),
  ]);
  return { roles, sections, competences, roleSections, roleCompetences };
}

export function grantSection(roleId: string, sectionId: string, grantedByLearnerId: string) {
  return prisma.roleSection.upsert({
    where: { roleId_sectionId: { roleId, sectionId } },
    update: {},
    create: { roleId, sectionId, grantedByLearnerId },
  });
}

export function revokeSection(roleId: string, sectionId: string) {
  return prisma.roleSection.deleteMany({ where: { roleId, sectionId } });
}

export function grantCompetence(roleId: string, competenceId: string, grantedByLearnerId: string) {
  return prisma.roleCompetence.upsert({
    where: { roleId_competenceId: { roleId, competenceId } },
    update: {},
    create: { roleId, competenceId, grantedByLearnerId },
  });
}

export function revokeCompetence(roleId: string, competenceId: string) {
  return prisma.roleCompetence.deleteMany({ where: { roleId, competenceId } });
}

import { prisma } from "../../db/prisma";
import type { LearnerProfileInput } from "./identity.types";

// All Prisma access for identity_* tables lives here.

/** What toLearnerDto needs: the role, and the profile for hasCompletedProfile. */
const learnerInclude = { userRole: true, profile: true } as const;

export function findLearnerById(id: string) {
  return prisma.learner.findUnique({ where: { id }, include: learnerInclude });
}

/**
 * Google's name is only the starting value: the learner can edit it in their
 * profile, so a later sign-in must not overwrite it.
 */
export function upsertLearnerFromGoogle(sub: string, email: string, name?: string | null) {
  return prisma.learner.upsert({
    where: { googleSubId: sub },
    update: { email },
    create: { email, name, googleSubId: sub },
    include: learnerInclude,
  });
}

/**
 * Email is required and unique on a learner, but ORCID only shares one the
 * user made public. So: a *verified* email may link this ORCID iD to the
 * learner that already has it (e.g. a Google account); in every other case —
 * no email, unverified, or taken by a learner with a different ORCID iD — the
 * account gets a placeholder address, and the ORCID iD is the real identity.
 * As with Google, a later sign-in never overwrites the name.
 */
export async function upsertLearnerFromOrcid(
  orcidId: string,
  email: string | null,
  emailVerified: boolean,
  name?: string | null,
) {
  const existing = await prisma.learner.findUnique({ where: { orcidId }, include: learnerInclude });
  if (existing) return existing;

  const verifiedEmail = email && emailVerified ? email.toLowerCase() : null;
  if (verifiedEmail) {
    const sameEmail = await prisma.learner.findUnique({ where: { email: verifiedEmail } });
    if (sameEmail && !sameEmail.orcidId) {
      return prisma.learner.update({
        where: { id: sameEmail.id },
        data: { orcidId },
        include: learnerInclude,
      });
    }
    if (!sameEmail) {
      return prisma.learner.create({
        data: { email: verifiedEmail, name, orcidId },
        include: learnerInclude,
      });
    }
  }

  return prisma.learner.create({
    data: { email: `${orcidId}@orcid.invalid`, name, orcidId },
    include: learnerInclude,
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
    include: learnerInclude,
  });
}

export function completeInitialAssessment(learnerId: string) {
  return prisma.learner.update({
    where: { id: learnerId },
    data: { hasCompletedInitialAssessment: true },
    include: learnerInclude,
  });
}

export function acceptPrivacyNotice(learnerId: string) {
  return prisma.learner.update({
    where: { id: learnerId },
    data: { privacyNoticeAcceptedAt: new Date() },
    include: learnerInclude,
  });
}

export function getLearnerProfile(learnerId: string) {
  return prisma.learnerProfile.findUnique({ where: { learnerId } });
}

/**
 * Saves the profile form: the name onto the learner, the rest onto their
 * profile, in one transaction. Returns the updated learner (with profile),
 * so the caller can send back a fresh LearnerDto.
 */
export async function saveLearnerProfile(learnerId: string, input: LearnerProfileInput) {
  const { name, ...profile } = input;
  const [, learner] = await prisma.$transaction([
    prisma.learnerProfile.upsert({
      where: { learnerId },
      update: profile,
      create: { learnerId, ...profile },
    }),
    prisma.learner.update({ where: { id: learnerId }, data: { name }, include: learnerInclude }),
  ]);
  return learner;
}

/**
 * GDPR account deletion (CD-60). Everything the learner owns — SAT
 * instances/responses/scores, their profile, their journey
 * recommendations, any grants they made, and feedback they sent — cascades
 * at the DB level (onDelete: Cascade throughout assessment.prisma/
 * identity.prisma/learningJourney.prisma/feedback.prisma), so this is just
 * the one delete.
 */
export function deleteLearner(learnerId: string) {
  return prisma.learner.delete({ where: { id: learnerId } });
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

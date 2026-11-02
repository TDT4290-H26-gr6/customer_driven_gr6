import { prisma } from "../../db/prisma";
import type { LearnerProfileInput } from "./identity.types";

// All Prisma access for identity_* tables lives here.

/** What toLearnerDto needs: the role, and the profile for hasCompletedProfile. */
const learnerInclude = { userRole: true, profile: true } as const;

/**
 * A deleted account keeps its row (see deletePersonalData), so every read
 * and write by id skips it: to the rest of the app it doesn't exist, and a
 * token that outlived it is a dead session.
 */
const notDeleted = { deletedAt: null } as const;

export function findLearnerById(id: string) {
  return prisma.learner.findUnique({ where: { id, ...notDeleted }, include: learnerInclude });
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
    where: { id: learnerId, ...notDeleted },
    data: { roleId },
    include: learnerInclude,
  });
}

export function completeInitialAssessment(learnerId: string) {
  return prisma.learner.update({
    where: { id: learnerId, ...notDeleted },
    data: { hasCompletedInitialAssessment: true },
    include: learnerInclude,
  });
}

export function acceptPrivacyNotice(learnerId: string) {
  return prisma.learner.update({
    where: { id: learnerId, ...notDeleted },
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
    prisma.learner.update({
      where: { id: learnerId, ...notDeleted },
      data: { name },
      include: learnerInclude,
    }),
  ]);
  return learner;
}

// --- Account deletion (CD-60, CD-124) ---

/** How long after "Delete account" the personal data is deleted; the learner can cancel until then. */
export const DELETION_GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Starts the countdown: the personal data is deleted DELETION_GRACE_DAYS
 * from now, by deleteDuePersonalData. Asking again while one is pending
 * keeps the original date, so it can't be pushed back by accident.
 */
export function scheduleDeletion(learnerId: string, now = new Date()) {
  return prisma.learner.update({
    where: { id: learnerId, ...notDeleted, deletionScheduledFor: null },
    data: { deletionScheduledFor: new Date(now.getTime() + DELETION_GRACE_DAYS * DAY_MS) },
    include: learnerInclude,
  });
}

export function cancelDeletion(learnerId: string) {
  return prisma.learner.update({
    where: { id: learnerId, ...notDeleted },
    data: { deletionScheduledFor: null },
    include: learnerInclude,
  });
}

/**
 * Deletes one learner's personal data, if their deletion is (still) due ,
 * a cancel that lands first wins. Deleted: email, name and Google id (so
 * signing in again starts a new account), role, the whole profile
 * (industry, degree, years of experience, background, goals), and the AI
 * advice (written from that profile, so it can repeat it). Kept for the
 * research: their assessments, answers and scores, journey
 * recommendations, question views and feedback (shown unsigned to
 * admins); the stats export shows their role and profile columns empty.
 * Returns whether it deleted anything.
 */
export function deletePersonalData(learnerId: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.learner.updateMany({
      where: { id: learnerId, ...notDeleted, deletionScheduledFor: { lte: now } },
      data: {
        email: null,
        name: null,
        googleSubId: null,
        roleId: null,
        deletionScheduledFor: null,
        deletedAt: now,
      },
    });
    if (count === 0) return false;
    await tx.learnerProfile.deleteMany({ where: { learnerId } });
    await tx.advice.deleteMany({ where: { satInstance: { learnerId } } });
    return true;
  });
}

/**
 * Deletes the personal data of every learner whose 30 days are up. Run on a
 * timer (see startDeletionJob). One failure doesn't stop the rest; they are
 * all retried on the next run. Returns how many were deleted.
 */
export async function deleteDuePersonalData(now = new Date()) {
  const due = await prisma.learner.findMany({
    where: { ...notDeleted, deletionScheduledFor: { lte: now } },
    select: { id: true },
  });
  let deleted = 0;
  for (const { id } of due) {
    try {
      if (await deletePersonalData(id, now)) deleted++;
    } catch (err) {
      console.error(`Deleting personal data for learner ${id} failed:`, err);
    }
  }
  return deleted;
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
 * assessment module, reading them here is the read-only cross-module access
 * context/backend-structure.md allows.
 */
export async function getVisibilityMatrix() {
  const [roles, sections, competences, roleSections, roleCompetences] = await Promise.all([
    prisma.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.section.findMany({
      where: { retiredAt: null },
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

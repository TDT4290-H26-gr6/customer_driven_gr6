import type { Learner, LearnerProfile, Role } from "@prisma/client";
import { isAdminEmail } from "./identity.admin";

export type LearnerWithRole = Learner & {
  userRole: Role | null;
  profile: LearnerProfile | null;
};

export type LearnerDto = {
  id: string;
  email: string;
  name: string | null;
  role: Role | null;
  hasCompletedInitialAssessment: boolean;
  /** Ticked the information-letter checkbox on the profile step. */
  hasAcceptedPrivacyNotice: boolean;
  /** Every profile field is filled in — required before taking the assessment. */
  hasCompletedProfile: boolean;
  /** May use admin mode — so the frontend can hide it; requireAdmin is the real check. */
  isAdmin: boolean;
  /** When the account's personal data will be deleted, or null if no deletion is pending. */
  deletionScheduledFor: Date | null;
};

export function toLearnerDto(learner: LearnerWithRole): LearnerDto {
  return {
    id: learner.id,
    // Only a deleted account has no email, and those never get a DTO
    // (findLearnerById doesn't return them).
    email: learner.email ?? "",
    name: learner.name,
    role: learner.userRole,
    hasCompletedInitialAssessment: learner.hasCompletedInitialAssessment,
    hasAcceptedPrivacyNotice: learner.privacyNoticeAcceptedAt !== null,
    hasCompletedProfile: isProfileComplete(learner.name, learner.profile),
    isAdmin: isAdminEmail(learner.email),
    deletionScheduledFor: learner.deletionScheduledFor,
  };
}

/** The dropdown options. Stored as the key; the frontend shows its own labels. */
export const INDUSTRIES = ["higher_education", "industry_business", "government"] as const;
export const ACADEMIC_DEGREES = ["bachelor", "master", "phd", "other"] as const;

export type Industry = (typeof INDUSTRIES)[number];
export type AcademicDegree = (typeof ACADEMIC_DEGREES)[number];

/** Readable names, for the AI advice prompt. Same wording as the frontend's dropdowns. */
export const INDUSTRY_LABELS: Record<Industry, string> = {
  higher_education: "Higher education",
  industry_business: "Industry/business",
  government: "Government",
};
export const ACADEMIC_DEGREE_LABELS: Record<AcademicDegree, string> = {
  bachelor: "Bachelor's",
  master: "Master's",
  phd: "PhD",
  other: "Other",
};

/**
 * Every field the learner must fill in before taking the assessment. A
 * profile saved before these were required (or never saved) is incomplete.
 */
export function isProfileComplete(
  name: string | null,
  profile: Pick<
    LearnerProfile,
    "industry" | "academicDegree" | "background" | "yearsOfExperience"
  > | null,
): boolean {
  return (
    !!name?.trim() &&
    !!profile &&
    (INDUSTRIES as readonly string[]).includes(profile.industry ?? "") &&
    (ACADEMIC_DEGREES as readonly string[]).includes(profile.academicDegree ?? "") &&
    !!profile.background?.trim() &&
    profile.yearsOfExperience !== null
  );
}

export type LearnerProfileInput = {
  name: string;
  industry: Industry;
  academicDegree: AcademicDegree;
  background: string;
  yearsOfExperience: number;
  /** Optional — null when left blank. */
  goals: string | null;
};

export const MAX_NAME_LENGTH = 100;
const MAX_TEXT_LENGTH = 2000;

/**
 * Validates a PUT /auth/me/profile body. Every field but goals is required
 * — the profile has to be complete before the assessment — and text is
 * trimmed. A blank or missing goals is saved as null.
 * Pure so it's unit-testable without a request/response pair.
 */
export function validateProfileInput(
  body: unknown,
): { data: LearnerProfileInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Invalid request body" };
  const { name, industry, academicDegree, background, yearsOfExperience, goals } = body as Record<
    string,
    unknown
  >;

  if (typeof name !== "string" || name.trim() === "") return { error: "name is required" };
  if (name.trim().length > MAX_NAME_LENGTH) return { error: "name is too long" };

  if (!(INDUSTRIES as readonly unknown[]).includes(industry)) {
    return { error: `industry must be one of: ${INDUSTRIES.join(", ")}` };
  }
  if (!(ACADEMIC_DEGREES as readonly unknown[]).includes(academicDegree)) {
    return { error: `academicDegree must be one of: ${ACADEMIC_DEGREES.join(", ")}` };
  }

  if (typeof background !== "string" || background.trim() === "") {
    return { error: "background is required" };
  }
  if (background.trim().length > MAX_TEXT_LENGTH) return { error: "background is too long" };

  if (typeof yearsOfExperience !== "number" || !Number.isInteger(yearsOfExperience)) {
    return { error: "yearsOfExperience must be a whole number" };
  }
  if (yearsOfExperience < 0 || yearsOfExperience > 80) {
    return { error: "yearsOfExperience must be between 0 and 80" };
  }

  if (goals !== undefined && goals !== null && typeof goals !== "string") {
    return { error: "goals must be a string" };
  }
  const trimmedGoals = typeof goals === "string" ? goals.trim() : "";
  if (trimmedGoals.length > MAX_TEXT_LENGTH) return { error: "goals is too long" };

  return {
    data: {
      name: name.trim(),
      industry: industry as Industry,
      academicDegree: academicDegree as AcademicDegree,
      background: background.trim(),
      yearsOfExperience,
      goals: trimmedGoals || null,
    },
  };
}

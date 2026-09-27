import type { Learner, Role } from "@prisma/client";
import { isAdminEmail } from "./identity.admin";

export type LearnerWithRole = Learner & { userRole: Role | null };

export type LearnerDto = {
  id: string;
  email: string;
  name: string | null;
  role: Role | null;
  hasCompletedInitialAssessment: boolean;
  /** May use admin mode — so the frontend can hide it; requireAdmin is the real check. */
  isAdmin: boolean;
};

export function toLearnerDto(learner: LearnerWithRole): LearnerDto {
  return {
    id: learner.id,
    email: learner.email,
    name: learner.name,
    role: learner.userRole,
    hasCompletedInitialAssessment: learner.hasCompletedInitialAssessment,
    isAdmin: isAdminEmail(learner.email),
  };
}

export type LearnerProfileInput = {
  goals?: string | null;
  background?: string | null;
  yearsOfExperience?: number | null;
};

const MAX_TEXT_LENGTH = 2000;

/**
 * Validates a PUT /auth/me/profile body. Every field is optional (a learner
 * can fill in only what they want), but whatever's present has to be the
 * right shape — pure so it's unit-testable without a request/response pair.
 */
export function validateProfileInput(
  body: unknown,
): { data: LearnerProfileInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Invalid request body" };
  const { goals, background, yearsOfExperience } = body as Record<string, unknown>;

  for (const [key, value] of [
    ["goals", goals],
    ["background", background],
  ] as const) {
    if (value !== undefined && value !== null) {
      if (typeof value !== "string") return { error: `${key} must be a string` };
      if (value.length > MAX_TEXT_LENGTH) return { error: `${key} is too long` };
    }
  }

  if (yearsOfExperience !== undefined && yearsOfExperience !== null) {
    if (typeof yearsOfExperience !== "number" || !Number.isInteger(yearsOfExperience)) {
      return { error: "yearsOfExperience must be a whole number" };
    }
    if (yearsOfExperience < 0 || yearsOfExperience > 80) {
      return { error: "yearsOfExperience must be between 0 and 80" };
    }
  }

  return {
    data: {
      goals: goals as string | null | undefined,
      background: background as string | null | undefined,
      yearsOfExperience: yearsOfExperience as number | null | undefined,
    },
  };
}

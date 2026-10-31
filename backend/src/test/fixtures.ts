import type { LearnerWithRole } from "../modules/identity/identity.types";

// Small builders for the rows route tests hand back from mocked services.

const NOW = new Date("2026-01-01T00:00:00.000Z");

/** A learner as findLearnerById returns it (with role and profile). */
export function learner(overrides: Partial<LearnerWithRole> = {}): LearnerWithRole {
  return {
    id: "learner-1",
    email: "learner@example.com",
    name: "Ada",
    googleSubId: "google-sub-1",
    orcidId: null,
    roleId: null,
    userRole: null,
    profile: null,
    hasCompletedInitialAssessment: false,
    privacyNoticeAcceptedAt: null,
    deletionScheduledFor: null,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** A learner whose profile is complete, so they may take the assessment. */
export function learnerWithProfile(overrides: Partial<LearnerWithRole> = {}): LearnerWithRole {
  return learner({
    profile: {
      id: "profile-1",
      learnerId: "learner-1",
      industry: "higher_education",
      academicDegree: "phd",
      background: "Research software",
      yearsOfExperience: 4,
      goals: null,
      updatedAt: NOW,
    },
    ...overrides,
  });
}

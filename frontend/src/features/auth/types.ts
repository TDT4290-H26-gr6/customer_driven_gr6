import type { Role } from "@/shared/types/models";

export type Learner = {
  id: string;
  email: string;
  name: string;
  role?: Role | null;
  hasCompletedInitialAssessment: boolean;
  /** Ticked the information-letter checkbox when signing in. */
  hasAcceptedPrivacyNotice: boolean;
  /** Every profile field is filled in. Required before taking the assessment. */
  hasCompletedProfile: boolean;
  /** May use admin mode. Only hides the UI — the backend enforces it. */
  isAdmin: boolean;
};

export type LoginResult = {
  token: string;
  learner: Learner;
};

export type { Role };

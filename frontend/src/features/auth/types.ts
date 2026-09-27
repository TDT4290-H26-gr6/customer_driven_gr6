import type { Role } from "@/shared/types/models";

export type Learner = {
  id: string;
  email: string;
  name: string;
  role?: Role | null;
  hasCompletedInitialAssessment: boolean;
  /** May use admin mode. Only hides the UI — the backend enforces it. */
  isAdmin: boolean;
};

export type LoginResult = {
  token: string;
  learner: Learner;
};

export type { Role };

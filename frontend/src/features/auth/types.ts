import type { Role } from "@/shared/types/models";

export type Learner = {
  id: string;
  email: string;
  name: string;
  role?: Role | null;
  hasCompletedInitialAssessment: boolean;
};

export type LoginResult = {
  token: string;
  learner: Learner;
};

export type { Role };

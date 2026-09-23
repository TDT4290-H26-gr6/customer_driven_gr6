export type LearnerProfile = {
  goals: string | null;
  background: string | null;
  yearsOfExperience: number | null;
};

export type LearnerProfileInput = Partial<LearnerProfile>;

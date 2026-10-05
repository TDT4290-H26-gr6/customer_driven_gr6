export type LearningJourneyModule = {
  id: string;
  order: number;
  title: string;
  description: string | null;
};

export type LearningJourney = {
  id: string;
  name: string;
  description: string | null;
  modules: LearningJourneyModule[];
  /** The sections the journey covers. Only included by listJourneys. */
  sections?: { sectionId: string }[];
};

/** One competence at or below the 60% threshold (CD-90), paired with the journey that addresses it. */
export type WeakCompetence = {
  competenceId: string;
  competenceName: string;
  score: number;
  maxScore: number;
  journey: { id: string; name: string } | null;
};

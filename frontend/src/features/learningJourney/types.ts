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
  /** The journey's page in Moodle, where the learner takes it (placeholder until the real page exists). */
  moodleUrl?: string | null;
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
  /** The journey that addresses it, with its Moodle page (placeholder until the real page exists). */
  journey: { id: string; name: string; moodleUrl: string | null } | null;
};

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

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

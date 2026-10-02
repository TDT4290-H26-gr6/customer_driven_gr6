export type SatHistoryArea = {
  name: string;
  score: number;
  maxScore: number;
};

export type SatHistoryEntry = {
  instanceNum: number;
  completedAt: string;
  sumScore: number;
  sumMaxScore: number;
  areas: SatHistoryArea[];
  /** The learning journey completed before this reassessment, or null for a normal run. */
  completedJourney: string | null;
  /** The sections the learner ticked for this reassessment (empty for a normal run). */
  reassessedSections: string[];
};

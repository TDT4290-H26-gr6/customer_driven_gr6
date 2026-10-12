export type SatHistoryArea = {
  name: string;
  score: number;
  maxScore: number;
};

/** One section's module scores in one SAT, modules in level order. */
export type SatHistorySection = {
  /** "A"–"E", or null for scores whose section is unknown ("Other"). */
  code: string | null;
  name: string;
  areas: SatHistoryArea[];
};

export type SatHistoryEntry = {
  instanceNum: number;
  completedAt: string;
  sumScore: number;
  sumMaxScore: number;
  /** Module scores grouped by section, in A–E order. */
  sections: SatHistorySection[];
  /** The learning journey completed before this reassessment, or null for a normal run. */
  completedJourney: string | null;
  /** The sections the learner ticked for this reassessment (empty for a normal run). */
  reassessedSections: string[];
};

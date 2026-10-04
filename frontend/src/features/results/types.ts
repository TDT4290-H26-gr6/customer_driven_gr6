export type CompetenceScore = {
  competence: { name: string };
  /**
   * The level (1 = A1 …) of the module this competence belongs to. Only on
   * per-section results; null for one that's no module's main competence.
   */
  level?: number | null;
  score: number;
  maxScore: number;
};

/**
 * One section's results in one SAT, for its own detailed radar. Competences
 * come in level order (A1 … A4). `assessed` is false for a section that SAT
 * didn't touch (e.g. one a journey retake left out) — every score is then
 * 0/0 and `level` is null. Otherwise `level` is how many of its levels the
 * learner passed from the bottom up — 0 if not even the first.
 */
export type SectionCompetenceScores = {
  section: { id: string; code?: string | null; name: string };
  assessed: boolean;
  level: number | null;
  levelCount: number;
  competences: CompetenceScore[];
};

/** One completed SAT's results, section by section. */
export type AttemptScores = {
  instanceNum: number;
  /** ISO timestamp. */
  completedAt: string;
  sections: SectionCompetenceScores[];
};

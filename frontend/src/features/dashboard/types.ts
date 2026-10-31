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
 * didn't touch (e.g. one a journey retake left out); every score is then
 * 0/0 and `level` is null. Otherwise `level` is how many of its levels the
 * learner passed from the bottom up, 0 if not even the first.
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

/** A section's result as of one assessment, and which SAT it actually comes from. */
export type SectionSnapshot = {
  /** Older than the assessment it's shown for when that one didn't retake the section. */
  instanceNum: number;
  score: number;
  maxScore: number;
  /** Levels passed from the bottom up (0 = not yet at the first). */
  level: number | null;
};

export type SectionProgress = {
  section: { id: string; code: string | null; name: string };
  levelCount: number;
  /** As of the latest assessment; null if never assessed. */
  latest: SectionSnapshot | null;
  /** As of the assessment before it; null if there's none, or it hadn't covered the section. */
  previous: SectionSnapshot | null;
};

/** The dashboard's before/after: the latest completed SAT and the one before it. */
export type DashboardProgress = {
  latest: { instanceNum: number; completedAt: string };
  previous: { instanceNum: number; completedAt: string } | null;
  sections: SectionProgress[];
};

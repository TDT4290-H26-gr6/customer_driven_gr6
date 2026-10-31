/** A module's best result over all the learner's assessments, and where it was achieved. */
export type BestResult = {
  /** Whole percent. */
  percent: number;
  /** ISO timestamp of the assessment it came from. */
  completedAt: string;
  /** "main": the self-assessment. "journey": a journey assessment. */
  kind: "main" | "journey";
  /** The journey that journey assessment covered; null for the self-assessment. */
  journeyName: string | null;
};

export type CompetencyModule = {
  id: string;
  /** e.g. "A2"; null when the module has no level. */
  code: string | null;
  name: string;
  /** Its page in Moodle (placeholder until the real page exists). */
  moodleUrl: string | null;
  /** In a section the recommended journey is centred on. */
  relevant: boolean;
  /** The best this module's ever scored, over every full self-assessment and journey assessment. */
  best: BestResult | null;
  /** This module's result from the single latest full self-assessment specifically; null if that attempt never reached it. */
  latest: BestResult | null;
};

export type CompetencySection = {
  id: string;
  code: string | null;
  name: string;
  relevant: boolean;
  /** The average of its modules' best-ever results; null before any has one. */
  percent: number | null;
  assessedModules: number;
  /** The average of its modules' latest-full-assessment results; null before any has one. */
  latestPercent: number | null;
  latestAssessedModules: number;
  moduleCount: number;
  modules: CompetencyModule[];
};

/** The Competencies overview, always in A–E order. */
export type Competencies = {
  /** The journey recommended after the latest self-assessment, whose sections come first. */
  recommendedJourney: { id: string; name: string; moodleUrl: string | null } | null;
  /** The single full self-assessment "latest" results above are drawn from; null before any. */
  latestInstance: { instanceNum: number; completedAt: string } | null;
  sections: CompetencySection[];
};

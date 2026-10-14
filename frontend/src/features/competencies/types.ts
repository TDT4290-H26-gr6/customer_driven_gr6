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
  best: BestResult | null;
};

export type CompetencySection = {
  id: string;
  code: string | null;
  name: string;
  relevant: boolean;
  /** The average of its modules' best results; null before any has one. */
  percent: number | null;
  assessedModules: number;
  moduleCount: number;
  modules: CompetencyModule[];
};

/** The Competencies overview: relevant sections first, then A–E. */
export type Competencies = {
  /** The journey recommended after the latest self-assessment, whose sections come first. */
  recommendedJourney: { id: string; name: string; moodleUrl: string | null } | null;
  sections: CompetencySection[];
};

export type CompetenceScore = {
  competence: { name: string };
  score: number;
  maxScore: number;
};

/**
 * The learner's level in one section: how many of its levels (A1 … A4) they
 * have passed, from the bottom up — 0 if not even the first.
 */
export type SkillLevel = {
  section: { id: string; code: string | null; name: string };
  level: number;
  levelCount: number;
};

/**
 * One section's competence scores, for its own detailed radar. `assessed`
 * is false for a section the learner could be assessed in but hasn't
 * answered anything in yet — every score is then 0/0.
 */
export type SectionCompetenceScores = {
  section: { id: string; code?: string | null; name: string };
  assessed: boolean;
  /**
   * When the attempt these scores come from was completed (ISO string), or
   * null if not assessed. Sections can come from different attempts — a
   * retake only updates the sections it covered.
   */
  assessedAt: string | null;
  competences: CompetenceScore[];
};

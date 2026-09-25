export type CompetenceScore = {
  competence: { name: string };
  score: number;
  maxScore: number;
};

/** One assessed section's competence scores, for its own detailed radar. */
export type SectionCompetenceScores = {
  section: { id: string; name: string };
  competences: CompetenceScore[];
};

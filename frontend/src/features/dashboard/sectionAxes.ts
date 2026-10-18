import type { CompetenceScore, SectionCompetenceScores } from "./types";

/**
 * Rolls each section's own competences into a single score, for the
 * dashboard's overview radar — one axis per section instead of one per
 * competence (with 20 competences that would be unreadable). The
 * per-section breakdown itself still lives on the "See results by section" page.
 */
export function sectionAxes(sections: SectionCompetenceScores[]): CompetenceScore[] {
  return sections.map(({ section, competences }) => ({
    competence: { name: section.name },
    score: competences.reduce((sum, c) => sum + c.score, 0),
    maxScore: competences.reduce((sum, c) => sum + c.maxScore, 0),
  }));
}

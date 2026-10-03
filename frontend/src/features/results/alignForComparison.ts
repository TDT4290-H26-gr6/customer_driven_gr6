import type { CompetenceScore } from "./types";

/**
 * Puts two SATs' scores for one section on the same axes, so they can be
 * drawn over each other: the main SAT's competences in their own (level)
 * order, then any only the other SAT has (e.g. the section's content changed
 * in between). A competence missing from one side counts as 0/0 there.
 */
export function alignForComparison(
  main: CompetenceScore[],
  other: CompetenceScore[],
): { main: CompetenceScore[]; other: CompetenceScore[] } {
  const names = main.map((c) => c.competence.name);
  for (const c of other) {
    if (!names.includes(c.competence.name)) names.push(c.competence.name);
  }

  const pick = (list: CompetenceScore[], name: string): CompetenceScore =>
    list.find((c) => c.competence.name === name) ?? { competence: { name }, score: 0, maxScore: 0 };

  return {
    main: names.map((name) => pick(main, name)),
    other: names.map((name) => pick(other, name)),
  };
}

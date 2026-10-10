// Which competences the AI advice should point the learner at. Pure (no
// Prisma, no LLM) so the rules are unit-testable directly; the service turns
// the result into candidates (their sources) for the LLM to choose from.

export type ScoredCompetence = { percent: number };

/**
 * The rules for how much to recommend:
 * - every competence at or below the weak threshold is a target;
 * - none is: the single lowest-scoring competence still is, so the learner
 *   always gets at least one recommendation;
 * - a perfect score (100% everywhere) is the only case with none.
 *
 * `minSteps` is 1 whenever there's a target, else 0. Expects the
 * competences weakest first, with nothing unscorable in them.
 */
export function selectTargets<T extends ScoredCompetence>(
  weakestFirst: T[],
  weakThreshold: number,
): { targets: T[]; minSteps: 0 | 1 } {
  const improvable = weakestFirst.filter((c) => c.percent < 100);
  if (improvable.length === 0) return { targets: [], minSteps: 0 };

  const weak = improvable.filter((c) => c.percent <= weakThreshold * 100);
  return { targets: weak.length > 0 ? weak : [improvable[0]], minSteps: 1 };
}

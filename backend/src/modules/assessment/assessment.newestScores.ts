import type { Prisma } from "@prisma/client";
import { MAIN_KIND } from "./assessment.kinds";

// A reassessment can cover only some sections, so "the learner's current
// scores" can't just be their latest completed instance, that would drop
// every section it didn't cover. Instead each competence uses its newest
// score from any completed instance. Shared by the dashboard (here), the
// journey recommendation and the AI advice.

/**
 * findMany args for every CompetenceScore from the learner's completed main
 * instances (journey assessments never count), newest instance first, pass
 * the result to newestPerCompetence.
 */
export function completedCompetenceScoresQuery(learnerId: string) {
  return {
    where: { satInstance: { learnerId, kind: MAIN_KIND, completedAt: { not: null } } },
    orderBy: [{ satInstance: { completedAt: "desc" } }, { satInstanceId: "asc" }],
  } satisfies Prisma.CompetenceScoreFindManyArgs;
}

/** A score whose competence still exists, competenceId (and competence, when included) non-null. */
type LiveScore<T> = T & { competenceId: string } & (T extends { competence: infer C }
    ? { competence: NonNullable<C> }
    : unknown);

/**
 * Keeps the first (newest) row per competence, given rows newest first.
 * Scores whose competence has since been deleted are dropped: they stay in
 * History, but current results only cover content that still exists. Pure.
 */
export function newestPerCompetence<T extends { competenceId: string | null }>(
  rows: T[],
): LiveScore<T>[] {
  const seen = new Set<string>();
  return rows.filter((row): row is LiveScore<T> => {
    if (row.competenceId === null) return false;
    if ("competence" in row && row.competence === null) return false;
    if (seen.has(row.competenceId)) return false;
    seen.add(row.competenceId);
    return true;
  });
}

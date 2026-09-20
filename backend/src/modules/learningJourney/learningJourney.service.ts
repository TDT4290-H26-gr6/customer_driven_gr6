import { prisma } from "../../db/prisma";

// All Prisma access for learning_journey_* tables lives here. Reads of
// assessment_* tables (SatInstance, CompetenceScore, CompetenceArea) below
// are read-only cross-module queries — allowed per
// context/backend-structure.md §5 ("reads, never writes, via Prisma").

export function listJourneys() {
  return prisma.learningJourney.findMany({
    include: { modules: { orderBy: { order: "asc" } } },
  });
}

/**
 * v0 recommendation rule (Sprint 2, score-only — see AIOS Sprint Plan LJ03).
 * Recommends the journey targeting the learner's single lowest-scoring
 * competence area from their most recently completed SAT instance. Replaced
 * by a stated-goals-aware version in Sprint 4 once LearnerProfile (SAT23)
 * exists.
 *
 * Returns null when there's nothing to recommend yet (no completed
 * instance, or no journey targets that learner's weakest area) — a real,
 * expected state, not an error.
 */
export async function recommendJourney(learnerId: string) {
  const latestInstance = await prisma.satInstance.findFirst({
    where: { learnerId, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
  });
  if (!latestInstance) return null;

  const scores = await prisma.competenceScore.findMany({
    where: { satInstanceId: latestInstance.id },
  });
  // Areas differ in question count (and so in maxScore), so "weakest" has to
  // compare score/maxScore, not raw score — a 6/31 area isn't actually
  // stronger than a 2/14 one just because 6 > 2. Areas with no possible
  // score (maxScore 0, e.g. only self-rating questions) can't be "weak" by
  // this measure, so they're excluded rather than compared.
  const scored = scores.filter((s) => s.maxScore > 0);
  if (scored.length === 0) return null;

  const lowest = scored.reduce((min, s) =>
    s.score / s.maxScore < min.score / min.maxScore ? s : min,
  );

  const journey = await prisma.learningJourney.findFirst({
    where: { competenceAreaId: lowest.competenceAreaId },
    include: { modules: { orderBy: { order: "asc" } } },
  });
  if (!journey) return null;

  // Log a new recommendation event only when it actually changed — otherwise
  // every dashboard visit would insert a duplicate row and inflate the
  // Sprint 5 "recommendations given per user" stat this table feeds.
  const lastRecommendation = await prisma.journeyRecommendation.findFirst({
    where: { learnerId },
    orderBy: { createdAt: "desc" },
  });

  if (lastRecommendation?.journeyId !== journey.id) {
    const area = await prisma.competenceArea.findUnique({
      where: { id: lowest.competenceAreaId },
    });

    await prisma.journeyRecommendation.create({
      data: {
        learnerId,
        journeyId: journey.id,
        reason: area ? `Lowest score in ${area.name}` : null,
      },
    });
  }

  return journey;
}

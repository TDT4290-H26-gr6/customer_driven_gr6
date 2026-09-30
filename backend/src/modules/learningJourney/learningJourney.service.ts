import type { CoverageLevel } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { createKeyedLock } from "../../lib/keyedLock";

// All Prisma access for learning_journey_* tables lives here. Reads of
// assessment_* tables (SatInstance, CompetenceScore, Competence, SectionModule)
// below are read-only cross-module queries — allowed per
// context/backend-structure.md §5 ("reads, never writes, via Prisma").

const recommendationLock = createKeyedLock();

const journeyInclude = { modules: { orderBy: { order: "asc" as const } } };

// Lower is better: a journey centred on the section (M) beats one that
// recommends it (R) beats one that merely touches it (S).
const COVERAGE_RANK: Record<CoverageLevel, number> = { M: 0, R: 1, S: 2 };

export function listJourneys() {
  return prisma.learningJourney.findMany({ include: journeyInclude, orderBy: { name: "asc" } });
}

export type CompetenceScoreInput = {
  competenceId: string;
  score: number;
  maxScore: number;
};

/** A competence scoring at or below this share of its maxScore counts as weak enough to recommend. */
const WEAK_THRESHOLD = 0.5;

/**
 * Picks the competence a learner is weakest in, out of their scores for one
 * SAT instance — but only if they're actually struggling: a learner who
 * scored above 50% everywhere shouldn't get pushed into remedial content.
 * Pure (no Prisma) so it's unit-testable directly — see assessment.scoring.ts
 * for the same pattern.
 *
 * Competences differ in question count (and so in maxScore), so "weakest"
 * has to compare score/maxScore, not raw score — a 6/31 competence isn't
 * actually stronger than a 2/14 one just because 6 > 2. Competences with
 * nothing scorable (maxScore 0), or scoring above the 50% threshold, can't
 * be weak and are skipped. Returns null when none qualify.
 */
export function pickWeakestCompetence(scores: CompetenceScoreInput[]): string | null {
  const weak = scores.filter((s) => s.maxScore > 0 && s.score / s.maxScore <= WEAK_THRESHOLD);
  if (weak.length === 0) return null;

  const lowest = weak.reduce((min, s) =>
    s.score / s.maxScore < min.score / min.maxScore ? s : min,
  );
  return lowest.competenceId;
}

/**
 * The sections a competence is taught in: those holding a module whose main
 * competence it is, or — if none does — a module that lists it as secondary.
 */
async function sectionIdsForCompetence(competenceId: string): Promise<string[]> {
  const asMain = await prisma.sectionModule.findMany({
    where: { mainCompetenceId: competenceId },
    select: { sectionId: true },
  });
  if (asMain.length > 0) return [...new Set(asMain.map((m) => m.sectionId))];

  const asSecondary = await prisma.sectionModuleSecondaryCompetence.findMany({
    where: { competenceId },
    select: { module: { select: { sectionId: true } } },
  });
  return [...new Set(asSecondary.map((s) => s.module.sectionId))];
}

/**
 * The journey with the best coverage of any of the given sections: best
 * coverage level first, then the one covering the most of them, then by name
 * so the choice is stable.
 */
async function bestJourneyForSections(sectionIds: string[]) {
  if (sectionIds.length === 0) return null;

  const links = await prisma.journeySection.findMany({
    where: { sectionId: { in: sectionIds } },
    select: { journeyId: true, coverageLevel: true },
  });
  if (links.length === 0) return null;

  const stats = new Map<string, { bestRank: number; matched: number }>();
  for (const link of links) {
    const current = stats.get(link.journeyId) ?? { bestRank: Infinity, matched: 0 };
    current.bestRank = Math.min(current.bestRank, COVERAGE_RANK[link.coverageLevel]);
    current.matched += 1;
    stats.set(link.journeyId, current);
  }

  const journeys = await prisma.learningJourney.findMany({
    where: { id: { in: [...stats.keys()] } },
    include: journeyInclude,
  });

  return (
    journeys.sort((a, b) => {
      const sa = stats.get(a.id)!;
      const sb = stats.get(b.id)!;
      return sa.bestRank - sb.bestRank || sb.matched - sa.matched || a.name.localeCompare(b.name);
    })[0] ?? null
  );
}

/**
 * Recommends the journey that best covers the learner's weakest competence,
 * from their most recently completed SAT instance — but only among
 * competences scoring 50% or below (see pickWeakestCompetence); a learner
 * who did fine everywhere gets no recommendation at all, rather than one
 * manufactured from their relatively-weakest-but-still-fine competence. The
 * competence maps to sections via the modules it's the main (else a
 * secondary) competence of, and those sections to journeys via
 * journey_section coverage.
 *
 * Returns null when there's nothing to recommend (no completed instance, no
 * competence at or below the threshold, or no journey covers that
 * competence's sections) — a real, expected state, not an error.
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
  const weakestCompetenceId = pickWeakestCompetence(scores);
  if (!weakestCompetenceId) return null;

  const journey = await bestJourneyForSections(await sectionIdsForCompetence(weakestCompetenceId));
  if (!journey) return null;

  // Log a new recommendation event only when it actually changed — otherwise
  // every dashboard visit would insert a duplicate row and inflate the
  // Sprint 5 "recommendations given per user" stat this table feeds.
  // Serialized per learner: two requests at once (React StrictMode mounts
  // the dashboard twice in development) would otherwise both read the same
  // "last recommendation" and both insert.
  await recommendationLock(learnerId, async () => {
    const lastRecommendation = await prisma.journeyRecommendation.findFirst({
      where: { learnerId },
      orderBy: { createdAt: "desc" },
    });
    if (lastRecommendation?.journeyId === journey.id) return;

    const competence = await prisma.competence.findUnique({ where: { id: weakestCompetenceId } });

    await prisma.journeyRecommendation.create({
      data: {
        learnerId,
        journeyId: journey.id,
        reason: competence ? `Lowest score in ${competence.name}` : null,
      },
    });
  });

  return journey;
}

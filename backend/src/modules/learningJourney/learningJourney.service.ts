import type { CoverageLevel } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { MAIN_KIND } from "../assessment/assessment.kinds";
import { createKeyedLock } from "../../lib/keyedLock";
import {
  completedCompetenceScoresQuery,
  newestPerCompetence,
} from "../assessment/assessment.newestScores";

// All Prisma access for learning_journey_* tables lives here. Reads of
// assessment_* tables (SatInstance, CompetenceScore, Competence, SectionModule)
// below are read-only cross-module queries, allowed per
// context/backend-structure.md §5 ("reads, never writes, via Prisma").

const recommendationLock = createKeyedLock();

const journeyInclude = { modules: { orderBy: { order: "asc" as const } } };

// Lower is better: a journey centred on the section (M) beats one that
// recommends it (R) beats one that merely touches it (S).
const COVERAGE_RANK: Record<CoverageLevel, number> = { M: 0, R: 1, S: 2 };

/**
 * Every journey with its steps and the sections it covers, with how strongly
 *, for picking one before a reassessment, and for showing which sections
 * assessing a journey covers (its M sections).
 */
export function listJourneys() {
  return prisma.learningJourney.findMany({
    include: {
      ...journeyInclude,
      // Coverage of retired sections isn't shown.
      sections: {
        where: { section: { retiredAt: null } },
        select: {
          sectionId: true,
          coverageLevel: true,
          section: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export type CompetenceScoreInput = {
  competenceId: string;
  score: number;
  maxScore: number;
};

/**
 * A competence scoring at or below this share of its maxScore counts as weak
 * enough to flag. Shared with the AI advice (advisor.candidates.ts), so the
 * journey card, the weak-competences list and the advice agree on "weak".
 */
export const WEAK_THRESHOLD = 0.6;

/**
 * Competences scoring at or below the 60% threshold, weakest (lowest
 * score/maxScore) first. Competences differ in question count (and so in
 * maxScore), so "weakest" has to compare score/maxScore, not raw score, a
 * 6/31 competence isn't actually stronger than a 2/14 one just because
 * 6 > 2. Competences with nothing scorable (maxScore 0) can't be weak and
 * are excluded. `Array.prototype.sort` is stable, so a tie keeps the
 * original relative order.
 */
function weakestFirst(scores: CompetenceScoreInput[]): CompetenceScoreInput[] {
  return scores
    .filter((s) => s.maxScore > 0 && s.score / s.maxScore <= WEAK_THRESHOLD)
    .sort((a, b) => a.score / a.maxScore - b.score / b.maxScore);
}

/**
 * Picks the single competence a learner is weakest in, out of their scores
 * for one SAT instance, but only if they're actually struggling: a learner
 * who scored above 60% everywhere shouldn't get pushed into remedial
 * content. Pure (no Prisma) so it's unit-testable directly, see
 * assessment.scoring.ts for the same pattern. Returns null when nothing
 * scores at or below the threshold.
 */
export function pickWeakestCompetence(scores: CompetenceScoreInput[]): string | null {
  return weakestFirst(scores)[0]?.competenceId ?? null;
}

/**
 * The lowest-scoring competence that isn't already at 100%, with no
 * threshold, what a learner who's above it everywhere could still work on.
 * Null after a perfect score (or with nothing scorable). Pure, like
 * pickWeakestCompetence.
 */
export function pickLowestImprovable(scores: CompetenceScoreInput[]): string | null {
  const improvable = scores
    .filter((s) => s.maxScore > 0 && s.score < s.maxScore)
    .sort((a, b) => a.score / a.maxScore - b.score / b.maxScore);
  return improvable[0]?.competenceId ?? null;
}

/**
 * The sections a competence is taught in: those holding a module whose main
 * competence it is, or, if none does, a module that lists it as secondary.
 */
async function sectionIdsForCompetence(competenceId: string): Promise<string[]> {
  // Only modules and sections still in use: retired ones are never recommended.
  const asMain = await prisma.sectionModule.findMany({
    where: { mainCompetenceId: competenceId, retiredAt: null, section: { retiredAt: null } },
    select: { sectionId: true },
  });
  if (asMain.length > 0) return [...new Set(asMain.map((m) => m.sectionId))];

  const asSecondary = await prisma.sectionModuleSecondaryCompetence.findMany({
    where: { competenceId, module: { retiredAt: null, section: { retiredAt: null } } },
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
 * from their most recently completed SAT instance, but only among
 * competences scoring 60% or below (see pickWeakestCompetence); a learner
 * who did fine everywhere gets no recommendation at all, rather than one
 * manufactured from their relatively-weakest-but-still-fine competence. The
 * competence maps to sections via the modules it's the main (else a
 * secondary) competence of, and those sections to journeys via
 * journey_section coverage.
 *
 * Returns null when there's nothing to recommend (no completed instance, no
 * competence at or below the threshold, or no journey covers that
 * competence's sections), a real, expected state, not an error.
 */
export async function recommendJourney(learnerId: string) {
  const latestInstance = await prisma.satInstance.findFirst({
    where: { learnerId, kind: MAIN_KIND, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
  });
  if (!latestInstance) return null;

  // Newest score per competence across completed instances, a
  // reassessment may only have covered some sections.
  const scores = newestPerCompetence(
    await prisma.competenceScore.findMany(completedCompetenceScoresQuery(learnerId)),
  );
  const weakestCompetenceId = pickWeakestCompetence(scores);
  if (!weakestCompetenceId) return null;

  const journey = await bestJourneyForSections(await sectionIdsForCompetence(weakestCompetenceId));
  if (!journey) return null;

  // Log a new recommendation event only when it actually changed, otherwise
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

export type WeakCompetence = {
  competenceId: string;
  competenceName: string;
  score: number;
  maxScore: number;
  /** The journey that addresses this competence, or null if none covers its sections. */
  journey: { id: string; name: string; moodleUrl: string | null } | null;
};

/**
 * Every competence at or below the 60% threshold (CD-90), from the learner's
 * most recently completed SAT instance, not just the single weakest one
 * recommendJourney() picks. Lets the dashboard show the full picture of
 * where a learner is lacking, not only the one journey recommended right
 * now. Weakest first. Empty when nothing qualifies, everything's
 * sufficient, not an error.
 */
export async function weakCompetences(learnerId: string): Promise<WeakCompetence[]> {
  const latestInstance = await prisma.satInstance.findFirst({
    where: { learnerId, kind: MAIN_KIND, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
  });
  if (!latestInstance) return [];

  const scores = newestPerCompetence(
    await prisma.competenceScore.findMany(completedCompetenceScoresQuery(learnerId)),
  );
  const weak = weakestFirst(scores);
  if (weak.length === 0) return [];

  const competences = await prisma.competence.findMany({
    where: { id: { in: weak.map((w) => w.competenceId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(competences.map((c) => [c.id, c.name]));

  return Promise.all(
    weak.map(async (w) => {
      const journey = await bestJourneyForSections(await sectionIdsForCompetence(w.competenceId));
      return {
        competenceId: w.competenceId,
        competenceName: nameById.get(w.competenceId) ?? "Unknown competence",
        score: w.score,
        maxScore: w.maxScore,
        journey: journey
          ? { id: journey.id, name: journey.name, moodleUrl: journey.moodleUrl }
          : null,
      };
    }),
  );
}

/**
 * A journey to keep improving with, for a learner who has nothing at or
 * below the weak threshold, so the dashboard always offers at least one
 * journey unless the score is perfect. It's the journey that best covers
 * their lowest-scoring competence. Deliberately separate from
 * recommendJourney(): it isn't a "you're lacking" recommendation, and isn't
 * logged as one. Null after a perfect score, when something is weak (then
 * recommendJourney() applies), or when no journey covers it.
 */
export async function suggestJourney(learnerId: string) {
  const scores = newestPerCompetence(
    await prisma.competenceScore.findMany(completedCompetenceScoresQuery(learnerId)),
  );
  if (pickWeakestCompetence(scores)) return null;

  const lowest = pickLowestImprovable(scores);
  if (!lowest) return null;
  return bestJourneyForSections(await sectionIdsForCompetence(lowest));
}

export type JourneyCandidate = {
  id: string;
  name: string;
  description: string | null;
  /** How strongly the journey covers each of the asked-for sections it touches, best first. */
  coverage: { sectionId: string; section: string; level: CoverageLevel }[];
};

/**
 * Every journey covering any of the given sections, with how strongly it
 * covers each, for the AI advice to choose the one that fits the learner's
 * role. Ordered like bestJourneyForSections (best coverage level, then the
 * most sections covered, then name), so the first is the score-based pick.
 */
export async function journeyCandidatesForSections(
  sectionIds: string[],
): Promise<JourneyCandidate[]> {
  if (sectionIds.length === 0) return [];

  const links = await prisma.journeySection.findMany({
    where: { sectionId: { in: sectionIds } },
    select: {
      coverageLevel: true,
      section: { select: { id: true, name: true } },
      journey: { select: { id: true, name: true, description: true } },
    },
  });

  const byJourney = new Map<string, JourneyCandidate>();
  for (const link of links) {
    const candidate = byJourney.get(link.journey.id) ?? { ...link.journey, coverage: [] };
    candidate.coverage.push({
      sectionId: link.section.id,
      section: link.section.name,
      level: link.coverageLevel,
    });
    byJourney.set(link.journey.id, candidate);
  }

  const bestRank = (c: JourneyCandidate) =>
    Math.min(...c.coverage.map((x) => COVERAGE_RANK[x.level]));
  return [...byJourney.values()]
    .map((c) => ({
      ...c,
      coverage: c.coverage.sort((a, b) => COVERAGE_RANK[a.level] - COVERAGE_RANK[b.level]),
    }))
    .sort(
      (a, b) =>
        bestRank(a) - bestRank(b) ||
        b.coverage.length - a.coverage.length ||
        a.name.localeCompare(b.name),
    );
}

/** One journey with its steps, as the dashboard shows it. */
export function findJourney(id: string) {
  return prisma.learningJourney.findUnique({ where: { id }, include: journeyInclude });
}

/**
 * The dashboard's two journeys by score alone, the fallback when the AI
 * advisor (which also weighs the learner's profile) is off or fails, and the
 * order it starts from. Learner data never leaves the app here.
 * - Something at or below the weak threshold: "recommended". The first is
 *   recommendJourney()'s pick (so the recommendation log is unchanged), the
 *   second the next-best coverage of all the learner's weak sections.
 * - Nothing that weak (but not perfect): "suggested", the best coverage of
 *   the lowest-scoring area's sections, journeys to keep improving with.
 * Null when there's nothing to recommend (no completed assessment, or a
 * perfect score).
 */
export async function recommendJourneys(learnerId: string) {
  const scores = newestPerCompetence(
    await prisma.competenceScore.findMany(completedCompetenceScoresQuery(learnerId)),
  );
  const weak = weakestFirst(scores);

  let source: "recommended" | "suggested";
  let competenceIds: string[];
  let first: { id: string } | null = null;
  if (weak.length > 0) {
    source = "recommended";
    competenceIds = weak.map((w) => w.competenceId);
    first = await recommendJourney(learnerId);
  } else {
    const lowest = pickLowestImprovable(scores);
    if (!lowest) return null;
    source = "suggested";
    competenceIds = [lowest];
  }

  const sectionIds: string[] = [];
  for (const id of competenceIds) {
    for (const sectionId of await sectionIdsForCompetence(id)) {
      if (!sectionIds.includes(sectionId)) sectionIds.push(sectionId);
    }
  }
  const covering = await journeyCandidatesForSections(sectionIds);
  const ordered = first
    ? [first.id, ...covering.map((c) => c.id).filter((id) => id !== first!.id)]
    : covering.map((c) => c.id);
  const ids = ordered.slice(0, 2);
  if (ids.length === 0) return null;

  const journeys = await prisma.learningJourney.findMany({
    where: { id: { in: ids } },
    include: journeyInclude,
  });
  return {
    source,
    journeys: ids.flatMap((id) => journeys.filter((j) => j.id === id)),
  };
}

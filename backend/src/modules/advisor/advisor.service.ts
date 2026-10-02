import type { Advice } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { config } from "../../config";
import { chatJson, type LlmSettings } from "../../lib/llm";
import { createKeyedLock } from "../../lib/keyedLock";
import { findLearnerById, getLearnerProfile } from "../identity/identity.service";
import { ACADEMIC_DEGREE_LABELS, INDUSTRY_LABELS } from "../identity/identity.types";
import { recommendJourney } from "../learningJourney/learningJourney.service";
import {
  completedCompetenceScoresQuery,
  newestPerCompetence,
} from "../assessment/assessment.newestScores";
import {
  buildAdviceMessages,
  parseAdvice,
  type AdviceContext,
  type AdviceStep,
  type Candidate,
} from "./advisor.prompt";

// All Prisma access for advisor_* tables lives here. Reads of assessment_*
// and sources_* tables below are read-only cross-module queries, allowed per
// context/backend-structure.md; identity and learningJourney data comes
// through their services.

/** Only the weakest few competences feed the candidate list — that's where advice should point. */
const WEAK_COMPETENCES_FOR_CANDIDATES = 3;
const MAX_CANDIDATES = 15;

const adviceLock = createKeyedLock();

/** A stored dropdown key as its readable label; null for a missing or unknown key. */
function labelFor(labels: Record<string, string>, key: string | null | undefined): string | null {
  return key && Object.hasOwn(labels, key) ? labels[key] : null;
}

export type StoredStep = Pick<AdviceStep, "kind" | "id" | "title" | "url" | "reason">;

/**
 * Everything the LLM gets to see, as of the learner's latest completed SAT
 * instance. Scores are the newest per competence across all completed
 * instances, since a reassessment may only have covered some sections. The
 * candidates are the recommended journey's steps plus the sources linked to
 * the learner's weakest competences — so whatever the sources table holds
 * (placeholder Moodle links today, the real catalogue later) is what can be
 * recommended.
 */
async function buildContext(learnerId: string): Promise<AdviceContext> {
  const [learner, profile, journey, allScores] = await Promise.all([
    findLearnerById(learnerId),
    getLearnerProfile(learnerId),
    recommendJourney(learnerId),
    prisma.competenceScore.findMany({
      ...completedCompetenceScoresQuery(learnerId),
      include: {
        competence: {
          include: {
            primarySource: true,
            secondarySources: { include: { source: true } },
            mainForModules: { select: { section: { select: { name: true } } }, take: 1 },
          },
        },
      },
    }),
  ]);
  const scores = newestPerCompetence(allScores);

  const weakestFirst = scores
    .filter((s) => s.maxScore > 0)
    .map((s) => ({ ...s, percent: (s.score / s.maxScore) * 100 }))
    .sort((a, b) => a.percent - b.percent);

  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  function add(candidate: Candidate) {
    const key = `${candidate.kind}:${candidate.id}`;
    if (seen.has(key) || candidates.length >= MAX_CANDIDATES) return;
    seen.add(key);
    candidates.push(candidate);
  }

  if (journey) {
    const sourceIds = journey.modules.flatMap((m) => (m.sourceId ? [m.sourceId] : []));
    const sources = await prisma.source.findMany({ where: { id: { in: sourceIds } } });
    const urlBySource = new Map(sources.map((s) => [s.id, s.sourceUrl]));
    for (const module of journey.modules) {
      add({
        kind: "module",
        id: module.id,
        title: module.title,
        description: module.description,
        competence: null,
        url: module.sourceId ? (urlBySource.get(module.sourceId) ?? null) : null,
      });
    }
  }

  for (const { competence } of weakestFirst.slice(0, WEAK_COMPETENCES_FOR_CANDIDATES)) {
    for (const source of [
      competence.primarySource,
      ...competence.secondarySources.map((s) => s.source),
    ]) {
      add({
        kind: "source",
        id: source.id,
        title: `${source.courseName} (${source.institution})`,
        description: source.description,
        competence: competence.name,
        url: source.sourceUrl,
      });
    }
  }

  return {
    role: learner?.userRole?.name ?? null,
    profile: {
      industry: labelFor(INDUSTRY_LABELS, profile?.industry),
      academicDegree: labelFor(ACADEMIC_DEGREE_LABELS, profile?.academicDegree),
      background: profile?.background ?? null,
      yearsOfExperience: profile?.yearsOfExperience ?? null,
      goals: profile?.goals ?? null,
    },
    competences: weakestFirst.map((s) => ({
      name: s.competence.name,
      section: s.competence.mainForModules[0]?.section.name ?? null,
      percent: s.percent,
    })),
    journey: journey ? { name: journey.name, description: journey.description } : null,
    candidates,
  };
}

async function generateAdvice(
  llm: LlmSettings,
  learnerId: string,
  satInstanceId: string,
): Promise<Advice> {
  const context = await buildContext(learnerId);
  const reply = await chatJson(llm, buildAdviceMessages(context));
  const { summary, steps } = parseAdvice(reply, context.candidates);

  const storedSteps: StoredStep[] = steps.map(({ kind, id, title, url, reason }) => ({
    kind,
    id,
    title,
    url,
    reason,
  }));

  return prisma.advice.create({
    data: { satInstanceId, summary, steps: storedSteps, model: llm.model },
  });
}

/**
 * The AI advice for the learner's latest completed self-assessment:
 * generated the first time it's asked for, then read back from the table —
 * one LLM call per assessment, however often the results page is opened.
 *
 * Returns null when there's nothing to advise on yet (no completed
 * assessment) or the feature is off (no LLM_API_KEY). Throws if the LLM
 * fails; nothing is stored then, so the next visit tries again.
 */
export async function getOrCreateAdvice(learnerId: string, llm = config.llm) {
  if (!llm) return null;

  const latestInstance = await prisma.satInstance.findFirst({
    where: { learnerId, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
  });
  if (!latestInstance) return null;

  // Serialized per learner: two requests at once (React StrictMode mounts the
  // page twice in development) must not both call the LLM and both insert.
  return adviceLock(learnerId, async () => {
    const existing = await prisma.advice.findUnique({
      where: { satInstanceId: latestInstance.id },
    });
    return existing ?? generateAdvice(llm, learnerId, latestInstance.id);
  });
}

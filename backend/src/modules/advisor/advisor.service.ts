import type { Advice } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { config } from "../../config";
import { chatJson, type LlmSettings } from "../../lib/llm";
import { createKeyedLock } from "../../lib/keyedLock";
import { findLearnerById, getLearnerProfile } from "../identity/identity.service";
import { ACADEMIC_DEGREE_LABELS, INDUSTRY_LABELS } from "../identity/identity.types";
import { recommendJourney, WEAK_THRESHOLD } from "../learningJourney/learningJourney.service";
import {
  completedCompetenceScoresQuery,
  newestPerCompetence,
} from "../assessment/assessment.newestScores";
import { getDashboardProgress } from "../assessment/assessment.service";
import {
  buildAdviceMessages,
  parseAdvice,
  toAdviceProgress,
  type AdviceContext,
  type AdviceStep,
  type Candidate,
} from "./advisor.prompt";
import { selectTargets } from "./advisor.candidates";

// All Prisma access for advisor_* tables lives here. Reads of assessment_*
// and sources_* tables below are read-only cross-module queries, allowed per
// context/backend-structure.md; identity and learningJourney data comes
// through their services.

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
 * instances, since a reassessment may only have covered some sections.
 *
 * The candidates follow the competences the advice targets (every one at or
 * below the weak threshold, else the single lowest; none after a perfect
 * score — see advisor.candidates.ts), weakest first: first the curriculum
 * modules that teach them, linked to their page in Moodle, then the
 * recommended journey's steps, then any learning sources linked to them. The
 * Moodle links are placeholders until the real pages exist (MOODLE_BASE_URL
 * + the seed data's moodleCourseId). From a second assessment on, it also gets the dashboard's
 * per-section before/after, so the advice can comment on progress.
 */
async function buildContext(learnerId: string): Promise<AdviceContext> {
  const [learner, profile, journey, dashboard, allScores] = await Promise.all([
    findLearnerById(learnerId),
    getLearnerProfile(learnerId),
    recommendJourney(learnerId),
    getDashboardProgress(learnerId),
    prisma.competenceScore.findMany({
      ...completedCompetenceScoresQuery(learnerId),
      include: {
        competence: {
          include: {
            primarySource: true,
            secondarySources: { include: { source: true } },
            mainForModules: {
              select: {
                id: true,
                name: true,
                description: true,
                moodleUrl: true,
                section: { select: { name: true, code: true } },
                level: true,
              },
            },
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

  const { targets, minSteps } = selectTargets(weakestFirst, WEAK_THRESHOLD);

  // 1. The curriculum modules (A1 … E4) that teach each target competence —
  //    what the learner actually takes, in Moodle.
  for (const { competence } of targets) {
    const modules = [...competence.mainForModules].sort(
      (a, b) =>
        (a.section.code ?? "").localeCompare(b.section.code ?? "") ||
        (a.level ?? Infinity) - (b.level ?? Infinity),
    );
    for (const module of modules) {
      add({
        kind: "moodle_module",
        id: module.id,
        title: module.name,
        description: module.description,
        competence: competence.name,
        url: module.moodleUrl,
      });
    }
  }

  // 2. The recommended journey's steps.
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

  // 3. Any learning sources linked to the target competences.
  for (const { competence } of targets) {
    const sources = [competence.primarySource, ...competence.secondarySources.map((s) => s.source)];
    for (const source of sources) {
      if (!source) continue;
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
    minSteps,
    progress:
      dashboard?.previous != null
        ? toAdviceProgress(
            dashboard.latest.instanceNum,
            dashboard.previous.instanceNum,
            dashboard.sections,
          )
        : null,
  };
}

async function generateAdvice(
  llm: LlmSettings,
  learnerId: string,
  satInstanceId: string,
): Promise<Advice> {
  const context = await buildContext(learnerId);
  const reply = await chatJson(llm, buildAdviceMessages(context));
  const { summary, steps } = parseAdvice(reply, context.candidates, context.minSteps);

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

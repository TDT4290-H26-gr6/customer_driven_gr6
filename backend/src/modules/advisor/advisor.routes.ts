import { Router } from "express";
import type { Advice } from "@prisma/client";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import { findJourney } from "../learningJourney/learningJourney.service";
import { getOrCreateAdvice, type StoredStep } from "./advisor.service";

export const advisorRouter = Router();

type JourneyWithSteps = NonNullable<Awaited<ReturnType<typeof findJourney>>>;

function toJourneyDto(journey: JourneyWithSteps) {
  return {
    id: journey.id,
    name: journey.name,
    description: journey.description,
    moodleUrl: journey.moodleUrl,
    modules: journey.modules.map(({ id, order, title, description }) => ({
      id,
      order,
      title,
      description,
    })),
  };
}

function toAdviceDto(
  advice: Advice,
  ranked: { journey: JourneyWithSteps; reason: string | null }[],
) {
  const steps = advice.steps as StoredStep[];
  return {
    summary: advice.summary,
    steps: steps.map(({ kind, title, url, reason }) => ({ kind, title, url, reason })),
    // The journeys the AI ranked for this learner on their scores and
    // profile, best fit first, the dashboard highlights the first.
    journeys: ranked.map(({ journey, reason }) => ({ journey: toJourneyDto(journey), reason })),
    model: advice.model,
    generatedAt: advice.createdAt,
  };
}

/** The advice's ranked journeys that still exist, best first. */
async function rankedJourneys(advice: Advice) {
  const picks = [
    { id: advice.journeyId, reason: advice.journeyReason },
    { id: advice.runnerUpJourneyId, reason: advice.runnerUpJourneyReason },
  ];
  const ranked: { journey: JourneyWithSteps; reason: string | null }[] = [];
  for (const { id, reason } of picks) {
    const journey = id ? await findJourney(id) : null;
    if (journey) ranked.push({ journey, reason });
  }
  return ranked;
}

/**
 * 200 with the advice (including the journeys ranked for the learner, when
 * there are any), 204 when there's none to give (no completed assessment
 * yet, or the feature is off), 503 when the LLM couldn't be reached or
 * answered nonsense, the dashboard then just leaves the advice out, and
 * the score-based journeys still show.
 */
advisorRouter.get(
  "/advice",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    let advice: Advice | null;
    try {
      advice = await getOrCreateAdvice(req.learnerId!);
    } catch (err) {
      console.warn("AI advice could not be generated:", err);
      return res.status(503).json({ error: "AI advice is unavailable right now" });
    }

    if (!advice) return res.status(204).end();
    res.json(toAdviceDto(advice, await rankedJourneys(advice)));
  }),
);

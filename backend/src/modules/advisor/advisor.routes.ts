import { Router } from "express";
import type { Advice } from "@prisma/client";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import { findJourney } from "../learningJourney/learningJourney.service";
import { getOrCreateAdvice, type StoredStep } from "./advisor.service";

export const advisorRouter = Router();

type JourneyWithSteps = NonNullable<Awaited<ReturnType<typeof findJourney>>>;

function toAdviceDto(advice: Advice, journey: JourneyWithSteps | null) {
  const steps = advice.steps as StoredStep[];
  return {
    summary: advice.summary,
    steps: steps.map(({ kind, title, url, reason }) => ({ kind, title, url, reason })),
    // The journey the AI chose for this learner — the dashboard shows it
    // instead of the score-based pick, unless they selected one themselves.
    journey: journey && {
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
    },
    journeyReason: journey ? advice.journeyReason : null,
    model: advice.model,
    generatedAt: advice.createdAt,
  };
}

/**
 * 200 with the advice (including the journey chosen for the learner, when
 * there is one), 204 when there's none to give (no completed assessment
 * yet, or the feature is off), 503 when the LLM couldn't be reached or
 * answered nonsense — the results page then just leaves the advice out, and
 * the score-based journey still shows.
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
    const journey = advice.journeyId ? await findJourney(advice.journeyId) : null;
    res.json(toAdviceDto(advice, journey));
  }),
);

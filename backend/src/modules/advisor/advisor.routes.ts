import { Router } from "express";
import type { Advice } from "@prisma/client";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import { getOrCreateAdvice, type StoredStep } from "./advisor.service";

export const advisorRouter = Router();

function toAdviceDto(advice: Advice) {
  const steps = advice.steps as StoredStep[];
  return {
    summary: advice.summary,
    steps: steps.map(({ kind, title, url, reason }) => ({ kind, title, url, reason })),
    model: advice.model,
    generatedAt: advice.createdAt,
  };
}

/**
 * 200 with the advice, 204 when there's none to give (no completed
 * assessment yet, or the feature is off), 503 when the LLM couldn't be
 * reached or answered nonsense — the results page then just leaves the
 * advice out, and the score-based recommendation still shows.
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
    res.json(toAdviceDto(advice));
  }),
);

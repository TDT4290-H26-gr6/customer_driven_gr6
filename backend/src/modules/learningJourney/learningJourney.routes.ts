import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import {
  listJourneys,
  recommendJourney,
  suggestJourney,
  weakCompetences,
} from "./learningJourney.service";

export const learningJourneyRouter = Router();

learningJourneyRouter.get(
  "/learning-journeys",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (_req, res) => {
    res.json(await listJourneys());
  }),
);

learningJourneyRouter.get(
  "/learning-journeys/recommendation",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const journey = await recommendJourney(req.learnerId!);
    if (!journey) {
      res.status(204).end();
      return;
    }
    res.json(journey);
  }),
);

/**
 * Every competence the learner is at or below 60% on (CD-90), weakest
 * first, each paired with the journey that addresses it — not just the
 * single pick /recommendation returns. An empty array means every
 * competence is sufficient.
 */
/**
 * A journey to keep improving with, for a learner with nothing at or below
 * the weak threshold — so the dashboard always offers one unless the score
 * is perfect. 204 when there's none to suggest (something is weak, so
 * /recommendation applies; a perfect score; or no completed assessment).
 */
learningJourneyRouter.get(
  "/learning-journeys/suggestion",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const journey = await suggestJourney(req.learnerId!);
    if (!journey) return res.status(204).end();
    res.json(journey);
  }),
);

learningJourneyRouter.get(
  "/learning-journeys/weak-competences",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await weakCompetences(req.learnerId!));
  }),
);

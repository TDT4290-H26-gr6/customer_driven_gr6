import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import { listJourneys, recommendJourney } from "./learningJourney.service";

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

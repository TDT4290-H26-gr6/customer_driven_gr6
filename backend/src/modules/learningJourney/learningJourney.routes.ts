import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { listJourneys, recommendJourney } from "./learningJourney.service";

export const learningJourneyRouter = Router();

learningJourneyRouter.get(
  "/learning-journeys",
  requireAuth,
  requireRole,
  async (_req: AuthedRequest, res) => {
    res.json(await listJourneys());
  },
);

learningJourneyRouter.get(
  "/learning-journeys/recommendation",
  requireAuth,
  requireRole,
  async (req: AuthedRequest, res) => {
    const journey = await recommendJourney(req.learnerId!);
    if (!journey) {
      res.status(204).end();
      return;
    }
    res.json(journey);
  },
);

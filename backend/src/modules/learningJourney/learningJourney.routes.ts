import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import { listJourneys, recommendJourney } from "./learningJourney.service";
import { getSelectedJourney, selectJourney } from "../identity/identity.service";

export const learningJourneyRouter = Router();

/** Prisma's "foreign key constraint failed" — the journey id doesn't exist. */
function isForeignKeyError(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2003";
}

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
 * The journey the learner has explicitly chosen to follow (CD-33), if any —
 * distinct from /recommendation, which is always the current score-based
 * pick. Once a learner selects a journey, it sticks until they select a
 * different one.
 */
learningJourneyRouter.get(
  "/learning-journeys/selected",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const journey = await getSelectedJourney(req.learnerId!);
    if (!journey) {
      res.status(204).end();
      return;
    }
    res.json(journey);
  }),
);

learningJourneyRouter.put(
  "/learning-journeys/:id/select",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    try {
      res.json(await selectJourney(req.learnerId!, req.params.id));
    } catch (err) {
      if (isForeignKeyError(err))
        return res.status(404).json({ error: "Unknown learning journey" });
      throw err;
    }
  }),
);

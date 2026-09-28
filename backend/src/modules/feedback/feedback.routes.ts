import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireAdmin } from "../../middleware/requireAdmin";
import { asyncHandler } from "../../lib/asyncHandler";
import { findLearnerById } from "../identity/identity.service";
import { createFeedback, listFeedback } from "./feedback.service";
import { toFeedbackDto, validateFeedbackInput } from "./feedback.types";

export const feedbackRouter = Router();

// No requireRole: a tester should be able to tell us something is wrong on
// any screen, including before they've picked a persona.
feedbackRouter.post(
  "/feedback",
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const result = validateFeedbackInput(req.body);
    if ("error" in result) return res.status(400).json({ error: result.error });

    // A token that outlived a deleted account would otherwise fail the
    // foreign key and surface as a 500 instead of a dead session.
    if (!(await findLearnerById(req.learnerId!))) {
      return res.status(401).json({ error: "Account not found" });
    }

    await createFeedback(req.learnerId!, result.data);
    res.status(204).end();
  }),
);

feedbackRouter.get(
  "/admin/feedback",
  requireAuth,
  requireAdmin,
  asyncHandler<AuthedRequest>(async (_req, res) => {
    const feedback = await listFeedback();
    res.json(feedback.map(toFeedbackDto));
  }),
);

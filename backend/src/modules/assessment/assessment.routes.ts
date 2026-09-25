import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import {
  completeActiveInstance,
  getLatestCompetenceScores,
  getLatestSectionCompetenceScores,
  getProgress,
  getSatHistory,
  listQuestions,
  saveResponse,
} from "./assessment.service";

export const assessmentRouter = Router();

assessmentRouter.get(
  "/questions",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await listQuestions(req.learnerId!));
  }),
);

assessmentRouter.get(
  "/assessment/progress",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await getProgress(req.learnerId!));
  }),
);

assessmentRouter.post(
  "/assessment/responses",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { questionId, answer } = req.body ?? {};
    if (!questionId || answer === undefined) {
      return res.status(400).json({ error: "Missing questionId or answer" });
    }
    await saveResponse(req.learnerId!, questionId, answer);
    res.status(204).end();
  }),
);

assessmentRouter.post(
  "/assessment/complete",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    await completeActiveInstance(req.learnerId!);
    res.status(204).end();
  }),
);

assessmentRouter.get(
  "/competence-scores",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await getLatestCompetenceScores(req.learnerId!));
  }),
);

assessmentRouter.get(
  "/assessment/history",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await getSatHistory(req.learnerId!));
  }),
);

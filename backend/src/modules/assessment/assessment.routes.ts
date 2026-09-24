import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import {
  completeActiveInstance,
  getLatestCompetenceScores,
  getProgress,
  getSatHistory,
  listQuestions,
  saveResponse,
} from "./assessment.service";

export const assessmentRouter = Router();

assessmentRouter.get("/questions", requireAuth, requireRole, async (_req: AuthedRequest, res) => {
  res.json(await listQuestions());
});

assessmentRouter.get(
  "/assessment/progress",
  requireAuth,
  requireRole,
  async (req: AuthedRequest, res) => {
    res.json(await getProgress(req.learnerId!));
  },
);

assessmentRouter.post(
  "/assessment/responses",
  requireAuth,
  requireRole,
  async (req: AuthedRequest, res) => {
    const { questionId, answer } = req.body ?? {};
    if (!questionId || answer === undefined) {
      return res.status(400).json({ error: "Missing questionId or answer" });
    }
    await saveResponse(req.learnerId!, questionId, answer);
    res.status(204).end();
  },
);

assessmentRouter.post(
  "/assessment/complete",
  requireAuth,
  requireRole,
  async (req: AuthedRequest, res) => {
    await completeActiveInstance(req.learnerId!);
    res.status(204).end();
  },
);

assessmentRouter.get(
  "/competence-scores",
  requireAuth,
  requireRole,
  async (req: AuthedRequest, res) => {
    res.json(await getLatestCompetenceScores(req.learnerId!));
  },
);

assessmentRouter.get(
  "/assessment/history",
  requireAuth,
  requireRole,
  async (req: AuthedRequest, res) => {
    res.json(await getSatHistory(req.learnerId!));
  },
);

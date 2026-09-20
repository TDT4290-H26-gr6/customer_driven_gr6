import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import {
  completeSatInstance,
  findQuestionById,
  findSatInstance,
  getCompetenceScores,
  getLatestCompetenceScores,
  listQuestions,
  startSatInstance,
  submitResponse,
} from "./assessment.service";

export const assessmentRouter = Router();

assessmentRouter.get("/questions", requireAuth, requireRole, async (_req: AuthedRequest, res) => {
  res.json(await listQuestions());
});

assessmentRouter.post("/sat-instances", requireAuth, requireRole, async (req: AuthedRequest, res) => {
  res.json(await startSatInstance(req.learnerId!));
});

assessmentRouter.post("/responses", requireAuth, requireRole, async (req: AuthedRequest, res) => {
  const { satInstanceId, questionId, answer } = req.body ?? {};
  if (!satInstanceId || !questionId || answer === undefined) {
    return res.status(400).json({ error: "Missing satInstanceId, questionId or answer" });
  }

  const satInstance = await findSatInstance(satInstanceId);
  if (!satInstance || satInstance.learnerId !== req.learnerId) {
    return res.status(404).json({ error: "SAT instance not found" });
  }
  if (satInstance.completedAt) {
    return res.status(409).json({ error: "SAT instance already completed" });
  }

  const question = await findQuestionById(questionId);
  if (!question) return res.status(404).json({ error: "Question not found" });

  res.json(await submitResponse(satInstance.id, question, answer));
});

assessmentRouter.put(
  "/sat-instances/:id/complete",
  requireAuth,
  requireRole,
  async (req: AuthedRequest, res) => {
    const satInstance = await findSatInstance(req.params.id);
    if (!satInstance || satInstance.learnerId !== req.learnerId) {
      return res.status(404).json({ error: "SAT instance not found" });
    }

    // Re-completing an already-completed instance just returns its existing scores.
    const scores = satInstance.completedAt
      ? await getCompetenceScores(satInstance.id)
      : await completeSatInstance(satInstance.id);
    res.json(scores);
  },
);

assessmentRouter.get("/competence-scores", requireAuth, requireRole, async (req: AuthedRequest, res) => {
  res.json(await getLatestCompetenceScores(req.learnerId!));
});

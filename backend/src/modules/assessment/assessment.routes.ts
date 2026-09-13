import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { listQuestions } from "./assessment.service";

export const assessmentRouter = Router();

assessmentRouter.get("/questions", requireAuth, requireRole, async (_req: AuthedRequest, res) => {
  res.json(await listQuestions());
});

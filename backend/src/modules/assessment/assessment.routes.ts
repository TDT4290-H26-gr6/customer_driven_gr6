import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { listQuestions } from "./assessment.service";

export const assessmentRouter = Router();

assessmentRouter.get("/questions", requireAuth, async (_req: AuthedRequest, res) => {
  res.json(await listQuestions());
});

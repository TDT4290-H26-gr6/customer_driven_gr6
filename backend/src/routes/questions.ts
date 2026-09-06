import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";

export const questionsRouter = Router();

questionsRouter.get("/questions", requireAuth, async (_req: AuthedRequest, res) => {
  const questions = await prisma.question.findMany({
    include: { competenceArea: true },
  });
  res.json(questions);
});
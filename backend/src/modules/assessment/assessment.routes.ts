import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireObject, requireString } from "../../lib/validate";
import { findLearnerById } from "../identity/identity.service";
import { isProfileComplete } from "../identity/identity.types";
import {
  completeActiveInstance,
  discardActiveInstance,
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
    const questionId = requireString(req.body?.questionId, "questionId");
    // The frontend's PieAnswer wrapper ({ session, complete }) — always an object.
    const answer = requireObject(req.body?.answer, "answer") as Prisma.InputJsonObject;

    // The profile must be filled in before the assessment. The frontend
    // sends learners to it first; this is the real boundary.
    const learner = await findLearnerById(req.learnerId!);
    if (!learner || !isProfileComplete(learner.name, learner.profile)) {
      return res.status(403).json({ error: "Complete your profile first" });
    }

    const saved = await saveResponse(req.learnerId!, questionId, answer);
    if (!saved) return res.status(404).json({ error: "Unknown question" });
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

// Aborts the in-progress assessment, deleting its saved answers. 204 even
// when there was nothing to abort, so retrying is safe.
assessmentRouter.delete(
  "/assessment/active",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    await discardActiveInstance(req.learnerId!);
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
  "/competence-scores/by-section",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await getLatestSectionCompetenceScores(req.learnerId!));
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

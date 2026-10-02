import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireObject, requireString, requireStringArray } from "../../lib/validate";
import { findLearnerById } from "../identity/identity.service";
import { isProfileComplete } from "../identity/identity.types";
import {
  completeActiveInstance,
  discardActiveInstance,
  getAssessmentPath,
  getLatestCompetenceScores,
  getLatestSectionCompetenceScores,
  getProgress,
  getSatHistory,
  getSkillLevels,
  listAssessableSections,
  listQuestions,
  saveResponse,
  startReassessment,
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

// The adaptive route through the current attempt: answered questions on the
// path plus the next one (see assessment.path.ts).
assessmentRouter.get(
  "/assessment/path",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await getAssessmentPath(req.learnerId!));
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

// The sections a reassessment can be limited to.
assessmentRouter.get(
  "/assessment/sections",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await listAssessableSections(req.learnerId!));
  }),
);

// Starts a reassessment after a completed learning journey, limited to the
// chosen sections. (Without a journey nothing needs starting — the first
// saved answer creates a normal instance.)
assessmentRouter.post(
  "/assessment/start",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const completedJourneyId = requireString(req.body?.completedJourneyId, "completedJourneyId");
    const sectionIds = requireStringArray(req.body?.sectionIds, "sectionIds");

    const learner = await findLearnerById(req.learnerId!);
    if (!learner || !isProfileComplete(learner.name, learner.profile)) {
      return res.status(403).json({ error: "Complete your profile first" });
    }

    const result = await startReassessment(req.learnerId!, { completedJourneyId, sectionIds });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.status(204).end();
  }),
);

assessmentRouter.post(
  "/assessment/complete",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    // "none" is a 204 too: completing twice (a retried request) is harmless.
    if ((await completeActiveInstance(req.learnerId!)) === "unfinished") {
      return res.status(409).json({ error: "The assessment isn't finished yet" });
    }
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

// The learner's level (A1 … A4) in each section they've been assessed in.
assessmentRouter.get(
  "/skill-levels",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await getSkillLevels(req.learnerId!));
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

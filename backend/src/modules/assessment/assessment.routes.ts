import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import {
  plausibleDurationMs,
  requireObject,
  requireString,
  requireStringArray,
} from "../../lib/validate";
import { findLearnerById } from "../identity/identity.service";
import { isProfileComplete } from "../identity/identity.types";
import {
  completeActiveInstance,
  discardActiveInstance,
  getAssessmentPath,
  getAttemptSectionScores,
  getCompetencies,
  getDashboardProgress,
  getLatestCompetenceScores,
  getProgress,
  getSatHistory,
  listAssessableSections,
  listQuestions,
  saveResponse,
  startJourneyAssessment,
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

// A learner realistically spends well under this on one question; above it,
// the reading is more likely a backgrounded tab than genuine time-on-task.
const MAX_PLAUSIBLE_TIME_SPENT_MS = 60 * 60 * 1000;

assessmentRouter.post(
  "/assessment/responses",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const questionId = requireString(req.body?.questionId, "questionId");
    // The frontend's PieAnswer wrapper ({ session, complete }) — always an object.
    const answer = requireObject(req.body?.answer, "answer") as Prisma.InputJsonObject;
    const timeSpentMs = plausibleDurationMs(req.body?.timeSpentMs, MAX_PLAUSIBLE_TIME_SPENT_MS);

    // The profile must be filled in before the assessment. The frontend
    // sends learners to it first; this is the real boundary.
    const learner = await findLearnerById(req.learnerId!);
    if (!learner || !isProfileComplete(learner.name, learner.profile)) {
      return res.status(403).json({ error: "Complete your profile first" });
    }

    const saved = await saveResponse(req.learnerId!, questionId, answer, timeSpentMs);
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

// Starts a reassessment limited to the chosen sections. (Reassessing
// everything needs no start — the first saved answer creates a normal
// instance.)
assessmentRouter.post(
  "/assessment/start",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const sectionIds = requireStringArray(req.body?.sectionIds, "sectionIds");

    const learner = await findLearnerById(req.learnerId!);
    if (!learner || !isProfileComplete(learner.name, learner.profile)) {
      return res.status(403).json({ error: "Complete your profile first" });
    }

    const result = await startReassessment(req.learnerId!, sectionIds);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.status(204).end();
  }),
);

// Assesses one learning journey on its own: only the questions in its M
// sections, and the result never counts towards the main self-assessment.
assessmentRouter.post(
  "/assessment/journey",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const journeyId = requireString(req.body?.journeyId, "journeyId");

    const learner = await findLearnerById(req.learnerId!);
    if (!learner || !isProfileComplete(learner.name, learner.profile)) {
      return res.status(403).json({ error: "Complete your profile first" });
    }

    const result = await startJourneyAssessment(req.learnerId!, journeyId);
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

// One completed SAT's results per section, with the skill level in each: the
// latest SAT, or ?instance=<instanceNum> for an earlier one. 204 before any
// completed SAT; 404 for an instanceNum the learner hasn't completed.
assessmentRouter.get(
  "/competence-scores/by-section",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const raw = req.query.instance;
    let instanceNum: number | undefined;
    if (raw !== undefined) {
      instanceNum = Number(raw);
      if (typeof raw !== "string" || !Number.isInteger(instanceNum) || instanceNum < 1) {
        return res.status(400).json({ error: "instance must be a positive whole number" });
      }
    }

    const result = await getAttemptSectionScores(req.learnerId!, instanceNum);
    if (!result) {
      if (instanceNum !== undefined) return res.status(404).json({ error: "Unknown assessment" });
      return res.status(204).end();
    }
    res.json(result);
  }),
);

// The dashboard's before/after view: each section as of the latest completed
// SAT and the one before it (sections a SAT skipped keep their last known
// result). 204 before any completed SAT.
assessmentRouter.get(
  "/competence-scores/progress",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const progress = await getDashboardProgress(req.learnerId!);
    if (!progress) return res.status(204).end();
    res.json(progress);
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

// The Competencies tab: each module's best result over all assessments (main
// and journey), a percentage per section, and the recommended journey's
// sections first.
assessmentRouter.get(
  "/competencies",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    res.json(await getCompetencies(req.learnerId!));
  }),
);

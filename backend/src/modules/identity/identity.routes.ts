import { Router } from "express";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
import jwt from "jsonwebtoken";
import { config } from "../../config";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import { hasCompletedMainAssessment } from "../assessment/assessment.service";
import { requireString } from "../../lib/validate";
import {
  acceptPrivacyNotice,
  cancelDeletion,
  completeInitialAssessment,
  findLearnerById,
  findRole,
  getLearnerProfile,
  listRoles,
  saveLearnerProfile,
  scheduleDeletion,
  setLearnerRole,
  upsertLearnerFromGoogle,
} from "./identity.service";
import { toLearnerDto, validateProfileInput } from "./identity.types";

export const identityRouter = Router();

const googleClient = new OAuth2Client(config.googleClientId);

/** A Google ID token is a JWT, typically 800–1500 characters, far longer than an id. */
const MAX_CREDENTIAL_LENGTH = 4096;

identityRouter.post(
  "/auth/google",
  asyncHandler(async (req, res) => {
    const credential = requireString(req.body?.credential, "credential", MAX_CREDENTIAL_LENGTH);

    // Only the Google check itself is a 401, a database failure after it
    // is ours, and falls through to the error handler as a 500.
    let payload: TokenPayload | undefined;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.googleClientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.warn("Google token verification failed:", err);
      return res.status(401).json({ error: "Google token verification failed" });
    }
    if (!payload?.email || !payload.sub) {
      return res.status(400).json({ error: "Invalid Google token" });
    }

    const learner = await upsertLearnerFromGoogle(payload.sub, payload.email, payload.name);
    const token = jwt.sign({ learnerId: learner.id, email: learner.email }, config.jwtSecret, {
      algorithm: "HS256",
      expiresIn: "7d",
    });

    res.json({ token, learner: toLearnerDto(learner) });
  }),
);

identityRouter.get(
  "/auth/me",
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const learner = await findLearnerById(req.learnerId!);
    if (!learner) return res.status(404).json({ error: "Not found" });
    res.json(toLearnerDto(learner));
  }),
);

identityRouter.get(
  "/roles",
  requireAuth,
  asyncHandler<AuthedRequest>(async (_req, res) => {
    res.json(await listRoles());
  }),
);

identityRouter.put(
  "/auth/me/role",
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const roleId = requireString(req.body?.roleId, "roleId");

    const role = await findRole(roleId);
    if (!role) return res.status(404).json({ error: "Unknown role" });

    const learner = await setLearnerRole(req.learnerId!, roleId);
    res.json(toLearnerDto(learner));
  }),
);

// No requireRole: the notice is shown before the learner has picked a role.
identityRouter.put(
  "/auth/me/privacy-notice",
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const learner = await acceptPrivacyNotice(req.learnerId!);
    res.json(toLearnerDto(learner));
  }),
);

identityRouter.put(
  "/auth/me/initial-assessment",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    // Only a finished main self-assessment unlocks the dashboard, not a
    // journey assessment, which is taken on its own.
    if (!(await hasCompletedMainAssessment(req.learnerId!))) {
      return res.status(409).json({ error: "Finish the self-assessment first" });
    }
    const learner = await completeInitialAssessment(req.learnerId!);
    res.json(toLearnerDto(learner));
  }),
);

identityRouter.get(
  "/auth/me/profile",
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    // A deleted account has no profile either, but that's a dead session,
    // not "nothing filled in yet", 401 signs the frontend out.
    if (!(await findLearnerById(req.learnerId!))) {
      return res.status(401).json({ error: "Account not found" });
    }

    const profile = await getLearnerProfile(req.learnerId!);
    res.json(profile);
  }),
);

identityRouter.put(
  "/auth/me/profile",
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const result = validateProfileInput(req.body);
    if ("error" in result) return res.status(400).json({ error: result.error });

    // No requireRole here, so check the account still exists: a token that
    // outlived a deleted account would otherwise fail the profile's foreign
    // key and surface as a 500 instead of a dead session.
    if (!(await findLearnerById(req.learnerId!))) {
      return res.status(401).json({ error: "Account not found" });
    }

    // The learner, not the profile: the name and hasCompletedProfile both
    // live on the DTO, so the frontend can update its session in one go.
    const learner = await saveLearnerProfile(req.learnerId!, result.data);
    res.json(toLearnerDto(learner));
  }),
);

// "Delete account" in Settings: the personal data is deleted 30 days from
// now (see scheduleDeletion), and the learner can cancel until then. No
// requireRole, like the profile routes: anyone signed in may leave.
identityRouter.post(
  "/auth/me/deletion",
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const learner = await findLearnerById(req.learnerId!);
    if (!learner) return res.status(401).json({ error: "Account not found" });
    // Already pending: keep the original date.
    if (learner.deletionScheduledFor) return res.json(toLearnerDto(learner));

    res.json(toLearnerDto(await scheduleDeletion(req.learnerId!)));
  }),
);

identityRouter.delete(
  "/auth/me/deletion",
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    if (!(await findLearnerById(req.learnerId!))) {
      return res.status(401).json({ error: "Account not found" });
    }
    res.json(toLearnerDto(await cancelDeletion(req.learnerId!)));
  }),
);

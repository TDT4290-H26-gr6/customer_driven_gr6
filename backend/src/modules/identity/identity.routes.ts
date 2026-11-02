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
  upsertLearnerFromOrcid,
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

/** An ORCID authorization code is short; this just bounds what we forward to ORCID. */
const MAX_ORCID_CODE_LENGTH = 256;
const ORCID_ID = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

/** The primary public email on an ORCID record, if the user shares one. */
async function fetchPublicOrcidEmail(
  orcid: NonNullable<typeof config.orcid>,
  orcidId: string,
): Promise<{ email: string | null; verified: boolean }> {
  try {
    const res = await fetch(`${orcid.publicApiUrl}/v3.0/${orcidId}/email`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { email: null, verified: false };
    const body = (await res.json()) as {
      email?: { email: string; verified: boolean; primary: boolean }[];
    };
    const emails = body.email ?? [];
    const chosen = emails.find((entry) => entry.primary) ?? emails[0];
    return chosen
      ? { email: chosen.email, verified: chosen.verified }
      : { email: null, verified: false };
  } catch (err) {
    // Not having an email isn't fatal — the learner gets a placeholder.
    console.warn("ORCID email lookup failed:", err);
    return { email: null, verified: false };
  }
}

identityRouter.post(
  "/auth/orcid",
  asyncHandler(async (req, res) => {
    const orcid = config.orcid;
    if (!orcid) return res.status(404).json({ error: "ORCID login is not enabled" });

    const code = requireString(req.body?.code, "code", MAX_ORCID_CODE_LENGTH);

    // Only the ORCID exchange itself is a 401; what follows is ours.
    let orcidId: string;
    let name: string | null;
    try {
      const tokenRes = await fetch(`${orcid.baseUrl}/oauth/token`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: orcid.clientId,
          client_secret: orcid.clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: orcid.redirectUri,
        }),
      });
      if (!tokenRes.ok) throw new Error(`ORCID answered ${tokenRes.status}`);
      const token = (await tokenRes.json()) as { orcid?: string; name?: string };
      if (!token.orcid || !ORCID_ID.test(token.orcid)) throw new Error("No ORCID iD in response");
      orcidId = token.orcid;
      name = token.name?.trim() || null;
    } catch (err) {
      console.warn("ORCID code exchange failed:", err);
      return res.status(401).json({ error: "ORCID sign-in failed" });
    }

    const { email, verified } = await fetchPublicOrcidEmail(orcid, orcidId);
    const learner = await upsertLearnerFromOrcid(orcidId, email, verified, name);
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
    // A valid token for an account that's gone (deleted, or a reset
    // database): 401 like the routes below, so the app signs out instead of
    // waiting on a session that can't come back.
    if (!learner) return res.status(401).json({ error: "Account not found" });
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

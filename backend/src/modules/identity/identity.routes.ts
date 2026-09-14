import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { config } from "../../config";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import {
  findLearnerById,
  findRole,
  listRoles,
  setLearnerRole,
  upsertLearnerFromGoogle,
} from "./identity.service";
import { toLearnerDto } from "./identity.types";

export const identityRouter = Router();

const googleClient = new OAuth2Client(config.googleClientId);

identityRouter.post("/auth/google", async (req, res) => {
  const { credential } = req.body ?? {};
  if (!credential) return res.status(400).json({ error: "Missing credential" });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      return res.status(400).json({ error: "Invalid Google token" });
    }

    const learner = await upsertLearnerFromGoogle(payload.sub, payload.email, payload.name);
    const token = jwt.sign({ learnerId: learner.id, email: learner.email }, config.jwtSecret, {
      expiresIn: "7d",
    });

    res.json({ token, learner: toLearnerDto(learner) });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Google token verification failed" });
  }
});

identityRouter.get("/auth/me", requireAuth, async (req: AuthedRequest, res) => {
  const learner = await findLearnerById(req.learnerId!);
  if (!learner) return res.status(404).json({ error: "Not found" });
  res.json(toLearnerDto(learner));
});

identityRouter.get("/roles", requireAuth, async (_req: AuthedRequest, res) => {
  res.json(await listRoles());
});

identityRouter.put("/auth/me/role", requireAuth, async (req: AuthedRequest, res) => {
  const { roleId } = req.body ?? {};
  if (!roleId) return res.status(400).json({ error: "Missing roleId" });

  const role = await findRole(roleId);
  if (!role) return res.status(404).json({ error: "Unknown role" });

  const learner = await setLearnerRole(req.learnerId!, roleId);
  res.json(toLearnerDto(learner));
});

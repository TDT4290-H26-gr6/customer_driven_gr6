import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";

export const authRouter = Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

authRouter.post("/auth/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "Missing credential" });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      return res.status(400).json({ error: "Invalid Google token" });
    }

    const learner = await prisma.learner.upsert({
      where: { googleSubId: payload.sub },
      update: { email: payload.email, name: payload.name },
      create: { email: payload.email, name: payload.name, googleSubId: payload.sub },
      include: { userRole: true },
    });

    const sessionToken = jwt.sign(
      { learnerId: learner.id, email: learner.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token: sessionToken,
      learner: { id: learner.id, email: learner.email, name: learner.name, role: learner.userRole },
    });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Google token verification failed" });
  }
});

import { requireAuth, AuthedRequest } from "../middleware/requireAuth";

authRouter.get("/auth/me", requireAuth, async (req: AuthedRequest, res) => {
  const learner = await prisma.learner.findUnique({
    where: { id: req.learnerId },
    include: { userRole: true },
  });
  if (!learner) return res.status(404).json({ error: "Not found" });
  res.json({ id: learner.id, email: learner.email, name: learner.name, role: learner.userRole });
});
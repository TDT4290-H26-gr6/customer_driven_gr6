import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export interface AuthedRequest extends Request {
  learnerId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });

  let decoded: string | jwt.JwtPayload;
  try {
    const token = header.slice("Bearer ".length);
    // Pinned to the algorithm /auth/google signs with, so a token can't pick its own.
    decoded = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // A correctly signed token without a learnerId is still not a session.
  if (typeof decoded !== "object" || typeof decoded.learnerId !== "string") {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.learnerId = decoded.learnerId;
  next();
}

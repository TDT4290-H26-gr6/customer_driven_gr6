import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface AuthedRequest extends Request {
  learnerId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });

  try {
    const token = header.slice("Bearer ".length);
    const decoded = jwt.verify(token, JWT_SECRET) as { learnerId: string };
    req.learnerId = decoded.learnerId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
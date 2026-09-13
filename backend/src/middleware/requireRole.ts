import { Response, NextFunction } from "express";
import { AuthedRequest } from "./requireAuth";
import { findLearnerById } from "../modules/identity/identity.service";

/**
 * Must run after requireAuth. Blocks access to anything that assumes a
 * chosen persona (questions, courses, ...) until the learner actually has
 * one — the frontend also blocks with a modal (RoleGateModal) for UX, but
 * that's client-side and not something to trust: a learner with dev tools
 * can always fake their own client state, so this is the real boundary.
 */
export async function requireRole(req: AuthedRequest, res: Response, next: NextFunction) {
  const learner = await findLearnerById(req.learnerId!);
  if (!learner?.roleId) {
    return res.status(403).json({ error: "Role required" });
  }
  next();
}

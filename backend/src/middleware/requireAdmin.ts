import { AuthedRequest } from "./requireAuth";
import { asyncHandler } from "../lib/asyncHandler";
import { findLearnerById } from "../modules/identity/identity.service";
import { isAdminEmail } from "../modules/identity/identity.admin";

/**
 * Must run after requireAuth. Lets through only learners listed in
 * ADMIN_EMAILS (everyone in development when it's unset — see config.ts).
 * The frontend hides admin mode from non-admins too, but only this check
 * is a boundary.
 */
export const requireAdmin = asyncHandler<AuthedRequest>(async (req, res, next) => {
  const learner = await findLearnerById(req.learnerId!);
  if (!learner) return res.status(401).json({ error: "Account not found" });
  if (!isAdminEmail(learner.email)) return res.status(403).json({ error: "Admin only" });
  next();
});

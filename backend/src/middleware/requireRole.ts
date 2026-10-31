import { AuthedRequest } from "./requireAuth";
import { asyncHandler } from "../lib/asyncHandler";
import { config } from "../config";
import { findLearnerById } from "../modules/identity/identity.service";

/**
 * Must run after requireAuth. Blocks access to anything that assumes a
 * chosen persona (questions, courses, ...) until the learner actually has
 * one, the frontend also blocks with a modal (RoleGateModal) for UX, but
 * that's client-side and not something to trust: a learner with dev tools
 * can always fake their own client state, so this is the real boundary.
 *
 * Wrapped in asyncHandler: it runs before almost every route, so a failed
 * lookup here must become a 500, not an unhandled rejection that takes the
 * process down.
 *
 * While role selection is turned off (config.roleSelectionEnabled), only the
 * account check applies, nobody needs a role.
 */
export const requireRole = asyncHandler<AuthedRequest>(async (req, res, next) => {
  const learner = await findLearnerById(req.learnerId!);
  // A valid token for a learner that no longer exists (deleted account) is
  // a dead session, not a missing role, 401 makes the frontend sign out.
  if (!learner) return res.status(401).json({ error: "Account not found" });
  if (config.roleSelectionEnabled && !learner.roleId) {
    return res.status(403).json({ error: "Role required" });
  }
  next();
});

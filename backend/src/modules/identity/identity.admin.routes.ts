import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireAdmin } from "../../middleware/requireAdmin";
import { asyncHandler } from "../../lib/asyncHandler";
import { getVisibilityMatrix } from "./identity.service";

/**
 * Admin mode: which sections / competences each role may see (set by the
 * dataset), read by the admin page's filters.
 *
 * Gated by requireAdmin, learners listed in ADMIN_EMAILS (everyone in
 * development when it's unset; see config.ts). A stopgap until the planned
 * `security` module in context/backend-structure.md has real admin accounts.
 */
export const identityAdminRouter = Router();

identityAdminRouter.get(
  "/admin/visibility",
  requireAuth,
  requireAdmin,
  asyncHandler<AuthedRequest>(async (_req, res) => {
    res.json(await getVisibilityMatrix());
  }),
);

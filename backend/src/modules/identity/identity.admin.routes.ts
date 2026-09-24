import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import {
  getVisibilityMatrix,
  grantCompetence,
  grantSection,
  revokeCompetence,
  revokeSection,
} from "./identity.service";

/**
 * Admin mode: managing which sections / competences each role may see.
 *
 * For now any signed-in learner who has picked a role can reach these — that
 * is a deliberate demo-stage decision, not a security boundary. Before real
 * users exist, gate them on a real admin check (the planned `security`
 * module in context/backend-structure.md).
 */
export const identityAdminRouter = Router();

/** Prisma's "foreign key constraint failed" — the role / section / competence doesn't exist. */
function isForeignKeyError(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2003";
}

identityAdminRouter.get(
  "/admin/visibility",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (_req, res) => {
    res.json(await getVisibilityMatrix());
  }),
);

identityAdminRouter.put(
  "/admin/roles/:roleId/sections/:sectionId",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    try {
      await grantSection(req.params.roleId, req.params.sectionId, req.learnerId!);
      res.status(204).end();
    } catch (err) {
      if (isForeignKeyError(err)) return res.status(404).json({ error: "Unknown role or section" });
      throw err;
    }
  }),
);

identityAdminRouter.delete(
  "/admin/roles/:roleId/sections/:sectionId",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    await revokeSection(req.params.roleId, req.params.sectionId);
    res.status(204).end();
  }),
);

identityAdminRouter.put(
  "/admin/roles/:roleId/competences/:competenceId",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    try {
      await grantCompetence(req.params.roleId, req.params.competenceId, req.learnerId!);
      res.status(204).end();
    } catch (err) {
      if (isForeignKeyError(err)) {
        return res.status(404).json({ error: "Unknown role or competence" });
      }
      throw err;
    }
  }),
);

identityAdminRouter.delete(
  "/admin/roles/:roleId/competences/:competenceId",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (req, res) => {
    await revokeCompetence(req.params.roleId, req.params.competenceId);
    res.status(204).end();
  }),
);

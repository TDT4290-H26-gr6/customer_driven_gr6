import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../lib/asyncHandler";
import { listSources } from "./sources.service";

export const sourcesRouter = Router();

sourcesRouter.get(
  "/sources",
  requireAuth,
  requireRole,
  asyncHandler<AuthedRequest>(async (_req, res) => {
    res.json(await listSources());
  }),
);

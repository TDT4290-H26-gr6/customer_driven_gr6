import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { listCourses } from "./courses.service";

export const coursesRouter = Router();

coursesRouter.get("/courses", requireAuth, requireRole, async (_req: AuthedRequest, res) => {
  res.json(await listCourses());
});

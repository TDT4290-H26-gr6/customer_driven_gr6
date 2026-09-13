import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { listCourses } from "./courses.service";

export const coursesRouter = Router();

coursesRouter.get("/courses", requireAuth, async (_req: AuthedRequest, res) => {
  res.json(await listCourses());
});

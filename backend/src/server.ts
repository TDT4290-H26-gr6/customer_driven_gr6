import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { healthRouter } from "./modules/health/health.routes";
import { identityRouter } from "./modules/identity/identity.routes";
import { identityAdminRouter } from "./modules/identity/identity.admin.routes";
import { assessmentRouter } from "./modules/assessment/assessment.routes";
import { sourcesRouter } from "./modules/sources/sources.routes";
import { learningJourneyRouter } from "./modules/learningJourney/learningJourney.routes";

// Assembles the Express app. Registering a module = one import + one app.use().
export function buildServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(healthRouter);
  app.use(identityRouter);
  app.use(identityAdminRouter);
  app.use(assessmentRouter);
  app.use(sourcesRouter);
  app.use(learningJourneyRouter);

  // Catches whatever a route handler throws (see lib/asyncHandler.ts) so one
  // failed request is a 500, not a crashed process.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

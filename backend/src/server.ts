import express from "express";
import cors from "cors";
import { healthRouter } from "./modules/health/health.routes";
import { identityRouter } from "./modules/identity/identity.routes";
import { assessmentRouter } from "./modules/assessment/assessment.routes";
import { coursesRouter } from "./modules/courses/courses.routes";
import { learningJourneyRouter } from "./modules/learningJourney/learningJourney.routes";

// Assembles the Express app. Registering a module = one import + one app.use().
export function buildServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(healthRouter);
  app.use(identityRouter);
  app.use(assessmentRouter);
  app.use(coursesRouter);
  app.use(learningJourneyRouter);

  return app;
}

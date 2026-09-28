import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { config } from "./config";
import { toHttpError } from "./lib/httpError";
import { healthRouter } from "./modules/health/health.routes";
import { identityRouter } from "./modules/identity/identity.routes";
import { identityAdminRouter } from "./modules/identity/identity.admin.routes";
import { assessmentRouter } from "./modules/assessment/assessment.routes";
import { sourcesRouter } from "./modules/sources/sources.routes";
import { learningJourneyRouter } from "./modules/learningJourney/learningJourney.routes";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

// Limits are per client IP and deliberately generous: a whole class behind
// one campus NAT shares an IP, and an assessment saves every answer. They
// exist to stop a runaway client or a password-spraying script, not to
// meter normal use.
const apiLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  limit: 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests — please slow down and try again shortly." },
});

const loginLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  limit: 50,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts — please wait a few minutes." },
});

// Assembles the Express app. Registering a module = one import + one app.use().
export function buildServer() {
  const app = express();

  // Standard security headers (no sniffing, no framing, etc.) — this API
  // serves JSON only, so helmet's defaults fit as-is.
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins }));
  // Explicit (it's also Express's default) so the cap is visible where requests enter.
  app.use(express.json({ limit: "100kb" }));

  // /health stays unlimited so monitoring never trips the limiter.
  app.use(healthRouter);
  app.use(apiLimiter);
  app.use("/auth/google", loginLimiter);

  app.use(identityRouter);
  app.use(identityAdminRouter);
  app.use(assessmentRouter);
  app.use(sourcesRouter);
  app.use(learningJourneyRouter);

  // Unknown paths get JSON like every other error, not Express's HTML page.
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // Catches whatever a route handler throws (see lib/asyncHandler.ts) so one
  // failed request is an error response, not a crashed process. Client
  // mistakes (4xx) keep their message and get a one-line warning; anything
  // else is logged in full and hidden behind a generic 500.
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);

    const httpError = toHttpError(err);
    if (httpError.status >= 500) {
      console.error(err);
    } else {
      console.warn(`${req.method} ${req.originalUrl} → ${httpError.status} ${httpError.message}`);
    }
    res.status(httpError.status).json({ error: httpError.message });
  });

  return app;
}

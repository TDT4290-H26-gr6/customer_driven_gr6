import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireAdmin } from "../../middleware/requireAdmin";
import { asyncHandler } from "../../lib/asyncHandler";
import { toCsv } from "./stats.csv";
import { listQuestionRows, listTestRows } from "./stats.service";

/**
 * Admin-only CSV export for analysis (CD-23): two linked, tidy tables over
 * completed full self-assessments (see stats.service.ts for why partial
 * reassessments and standalone journey assessments are excluded). No
 * learner is identifiable from either file, no name or email, and years
 * of experience is bucketed, not exact (see
 * stats.csv.ts). The two join on satInstanceId, itself just a random id.
 */
export const statsRouter = Router();

statsRouter.get(
  "/admin/stats/tests.csv",
  requireAuth,
  requireAdmin,
  asyncHandler<AuthedRequest>(async (_req, res) => {
    const rows = await listTestRows();
    const csv = toCsv(
      [
        "satInstanceId",
        "role",
        "industry",
        "academicDegree",
        "experienceBucket",
        "startedAt",
        "completedAt",
        "durationMs",
        "activeTimeMs",
        "score",
        "maxScore",
        "scorePercent",
      ],
      rows,
    );
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.header("Content-Disposition", 'attachment; filename="aios-tests.csv"');
    res.send(csv);
  }),
);

statsRouter.get(
  "/admin/stats/questions.csv",
  requireAuth,
  requireAdmin,
  asyncHandler<AuthedRequest>(async (_req, res) => {
    const rows = await listQuestionRows();
    const csv = toCsv(
      ["satInstanceId", "role", "section", "competence", "score", "maxScore", "timeSpentMs"],
      rows,
    );
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.header("Content-Disposition", 'attachment; filename="aios-question-times.csv"');
    res.send(csv);
  }),
);

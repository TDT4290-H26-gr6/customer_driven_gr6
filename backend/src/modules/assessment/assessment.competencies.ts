// Pure logic for the Competencies overview — no Prisma — so it's
// unit-testable directly (same pattern as assessment.progress.ts).
// assessment.service.ts's getCompetencies loads the answers and calls these.

/** One scored answer, with the module it belongs to and the assessment it was given in. */
export type AnswerRow = {
  moduleId: string;
  satInstanceId: string;
  kind: string;
  completedAt: Date;
  /** The journey a journey assessment covered; null for the main self-assessment. */
  journeyName: string | null;
  score: number;
  maxScore: number;
};

/** A module's best result, and where it was achieved. */
export type BestResult = {
  /** Whole percent. */
  percent: number;
  completedAt: Date;
  kind: string;
  journeyName: string | null;
};

/**
 * Each module's best result over all the learner's assessments — main and
 * journey alike. A module's result in one assessment is its answers' points
 * over their maximum; the best is the highest percentage (the newest on a
 * tie). Modules never answered are absent.
 */
export function bestPerModule(rows: AnswerRow[]): Map<string, BestResult> {
  const perAttempt = new Map<string, { row: AnswerRow; score: number; maxScore: number }>();
  for (const row of rows) {
    const key = `${row.satInstanceId}:${row.moduleId}`;
    const entry = perAttempt.get(key) ?? { row, score: 0, maxScore: 0 };
    entry.score += row.score;
    entry.maxScore += row.maxScore;
    perAttempt.set(key, entry);
  }

  const best = new Map<string, BestResult>();
  for (const { row, score, maxScore } of perAttempt.values()) {
    if (maxScore <= 0) continue;
    const result: BestResult = {
      percent: Math.round((score / maxScore) * 100),
      completedAt: row.completedAt,
      kind: row.kind,
      journeyName: row.journeyName,
    };
    const current = best.get(row.moduleId);
    const better =
      !current ||
      result.percent > current.percent ||
      (result.percent === current.percent && result.completedAt > current.completedAt);
    if (better) best.set(row.moduleId, result);
  }
  return best;
}

/**
 * How competent the learner is in a section: the average of its modules'
 * best results, each module counting equally (they're separate topics).
 * Modules never answered are left out rather than counted as 0; null when
 * none has a result yet.
 */
export function sectionPercent(moduleResults: (BestResult | null)[]): number | null {
  const percents = moduleResults.flatMap((r) => (r ? [r.percent] : []));
  if (percents.length === 0) return null;
  return Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length);
}

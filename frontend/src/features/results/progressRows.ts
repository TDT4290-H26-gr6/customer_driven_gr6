import type { CompetenceScore, DashboardProgress, SectionSnapshot } from "./types";

/** One section's line in the dashboard's progress card. */
export type ProgressRow = {
  id: string;
  code: string | null;
  name: string;
  /** Whole percent, or null when there's nothing to show. */
  latestPercent: number | null;
  previousPercent: number | null;
  /** e.g. "B2", "below B1"; null when never assessed. */
  latestLevel: string | null;
  previousLevel: string | null;
  /** Latest minus previous, in percentage points; null unless both exist and the section was retaken. */
  change: number | null;
  /**
   * The latest assessment didn't cover the section, so the shown result is
   * from this older one; null when it's from the latest.
   */
  carriedFrom: number | null;
  assessed: boolean;
};

function percent(snapshot: SectionSnapshot | null): number | null {
  if (!snapshot || snapshot.maxScore <= 0) return null;
  return Math.round((snapshot.score / snapshot.maxScore) * 100);
}

export function levelLabel(code: string | null, snapshot: SectionSnapshot | null): string | null {
  if (!snapshot || snapshot.level === null) return null;
  const prefix = code ?? "";
  return snapshot.level > 0 ? `${prefix}${snapshot.level}` : `below ${prefix}1`;
}

/** Turns the progress data into what each line of the progress card shows. */
export function progressRows(progress: DashboardProgress): ProgressRow[] {
  return progress.sections.map(({ section, latest, previous }) => {
    const latestPercent = percent(latest);
    const previousPercent = progress.previous ? percent(previous) : null;
    const carriedFrom =
      latest && latest.instanceNum !== progress.latest.instanceNum ? latest.instanceNum : null;
    return {
      id: section.id,
      code: section.code,
      name: section.name,
      latestPercent,
      previousPercent,
      latestLevel: levelLabel(section.code, latest),
      previousLevel: progress.previous ? levelLabel(section.code, previous) : null,
      change:
        carriedFrom === null && latestPercent !== null && previousPercent !== null
          ? latestPercent - previousPercent
          : null,
      carriedFrom,
      assessed: latest !== null,
    };
  });
}

/**
 * The overview radar's axes (one per section) as of the latest or the
 * previous assessment. A section with no result yet sits at 0.
 */
export function radarAxes(
  progress: DashboardProgress,
  which: "latest" | "previous",
): CompetenceScore[] {
  return progress.sections.map((s) => ({
    competence: { name: s.section.name },
    score: s[which]?.score ?? 0,
    maxScore: s[which]?.maxScore ?? 0,
  }));
}

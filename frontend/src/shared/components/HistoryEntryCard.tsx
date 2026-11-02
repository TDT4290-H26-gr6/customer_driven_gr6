import type { ReactNode } from "react";
import { APP_LOCALE, DATE_FORMAT } from "@/shared/lib/format";
import styles from "./HistoryEntryCard.module.css";

// Questions can earn fractional points (e.g. 3 of 4 checkbox alternatives
// right), so show at most two decimals instead of a long float.
const POINTS_FORMAT = new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 2 });

function percent(score: number, maxScore: number): number {
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

/** One section's module scores in one attempt, modules in level order. */
export type HistoryEntrySection = {
  /** "A"–"E", or null for scores whose section is unknown ("Other"). */
  code: string | null;
  name: string;
  areas: { name: string; score: number; maxScore: number }[];
};

/**
 * One past assessment attempt's score breakdown: a heading, the date, the
 * summed score, then each section's module scores. The shared card shape
 * for both the main SAT's History page and the Learning Journeys page's
 * own History tab. `badge` is extra context under the header specific to
 * the caller, e.g. HistoryPage's "After completing X" / "Reassessed: Y".
 */
export function HistoryEntryCard({
  heading,
  completedAt,
  sumScore,
  sumMaxScore,
  sections,
  badge,
}: {
  heading: string;
  completedAt: string;
  sumScore: number;
  sumMaxScore: number;
  sections: HistoryEntrySection[];
  badge?: ReactNode;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardHeading}>{heading}</h2>
        <span className={styles.date}>{DATE_FORMAT.format(new Date(completedAt))}</span>
      </div>

      {badge}

      <p className={styles.sumScore}>
        {POINTS_FORMAT.format(sumScore)} / {POINTS_FORMAT.format(sumMaxScore)}
        <span className={styles.sumPercent}>({percent(sumScore, sumMaxScore)}%)</span>
      </p>

      {/* Each module's score under the section it belongs to, A–E. */}
      {sections.map((section) => (
        <div key={`${section.code ?? ""}|${section.name}`} className={styles.sectionGroup}>
          <h3 className={styles.sectionName}>
            {section.code ? `Section ${section.code} · ${section.name}` : section.name}
          </h3>
          <ul className={styles.areaList}>
            {section.areas.map((area) => (
              <li key={area.name} className={styles.areaRow}>
                <span className={styles.areaName}>{area.name}</span>
                <span className={styles.areaScore}>
                  {POINTS_FORMAT.format(area.score)} / {POINTS_FORMAT.format(area.maxScore)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

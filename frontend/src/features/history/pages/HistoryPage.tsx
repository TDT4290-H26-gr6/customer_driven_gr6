import { useEffect, useState } from "react";
import { Spinner } from "@/shared/components/Spinner";
import { getSatHistory } from "../api";
import type { SatHistoryEntry } from "../types";
import styles from "./HistoryPage.module.css";

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

// Questions can earn fractional points (e.g. 3 of 4 checkbox alternatives
// right), so show at most two decimals instead of a long float.
const POINTS_FORMAT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function percent(score: number, maxScore: number): number {
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

/**
 * Every completed self-assessment, oldest first (CD-21) — a timeline of how
 * a learner's score has evolved, with each attempt's own area breakdown so
 * it's clear what that specific SAT actually covered (relevant if a role
 * change ever changes which questions someone gets).
 */
export function HistoryPage() {
  const [entries, setEntries] = useState<SatHistoryEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    getSatHistory()
      .then(setEntries)
      .catch(() => {
        setEntries([]);
        setLoadFailed(true);
      });
  }, []);

  if (entries === null) {
    return (
      <div className={styles.page}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>History</h1>
      <p className={styles.subheading}>Every self-assessment you&apos;ve completed, in order.</p>

      {loadFailed && (
        <p className={styles.note}>Couldn&apos;t load your history right now. Please try again.</p>
      )}

      {!loadFailed && entries.length === 0 && (
        <p className={styles.note}>
          You haven&apos;t completed a self-assessment yet — finish one to see it here.
        </p>
      )}

      {entries.map((entry) => (
        <div key={entry.instanceNum} className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardHeading}>Assessment {entry.instanceNum}</h2>
            <span className={styles.date}>{DATE_FORMAT.format(new Date(entry.completedAt))}</span>
          </div>

          <p className={styles.sumScore}>
            {POINTS_FORMAT.format(entry.sumScore)} / {POINTS_FORMAT.format(entry.sumMaxScore)}
            <span className={styles.sumPercent}>
              ({percent(entry.sumScore, entry.sumMaxScore)}%)
            </span>
          </p>

          <ul className={styles.areaList}>
            {entry.areas.map((area) => (
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

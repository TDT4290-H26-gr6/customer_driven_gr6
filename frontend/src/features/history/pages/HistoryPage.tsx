import { useEffect, useState } from "react";
import { Spinner } from "@/shared/components/Spinner";
import { APP_LOCALE, DATE_FORMAT } from "@/shared/lib/format";
import { HistoryTrend } from "../components/HistoryTrend";
import { getSatHistory } from "../api";
import type { SatHistoryEntry } from "../types";
import styles from "./HistoryPage.module.css";

// Questions can earn fractional points (e.g. 3 of 4 checkbox alternatives
// right), so show at most two decimals instead of a long float.
const POINTS_FORMAT = new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 2 });

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
      <div className={styles.page} data-backdrop="logo">
        <Spinner />
      </div>
    );
  }

  return (
    <div className={styles.page} data-backdrop="logo">
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

      {entries.length >= 2 && (
        <HistoryTrend
          points={entries.map((entry) => ({
            instanceNum: entry.instanceNum,
            percent: percent(entry.sumScore, entry.sumMaxScore),
          }))}
        />
      )}

      <div className={styles.list}>
        {entries.map((entry) => (
          <div key={entry.instanceNum} className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardHeading}>Assessment {entry.instanceNum}</h2>
              <span className={styles.date}>{DATE_FORMAT.format(new Date(entry.completedAt))}</span>
            </div>

            {(entry.completedJourney || entry.reassessedSections.length > 0) && (
              <div className={styles.journey}>
                {entry.completedJourney && (
                  <p className={styles.journeyLine}>
                    After completing <strong>{entry.completedJourney}</strong>
                  </p>
                )}
                {entry.reassessedSections.length > 0 && (
                  <p className={styles.journeyLine}>
                    Reassessed: {entry.reassessedSections.join(", ")}
                  </p>
                )}
              </div>
            )}

            <p className={styles.sumScore}>
              {POINTS_FORMAT.format(entry.sumScore)} / {POINTS_FORMAT.format(entry.sumMaxScore)}
              <span className={styles.sumPercent}>
                ({percent(entry.sumScore, entry.sumMaxScore)}%)
              </span>
            </p>

            {/* Each module's score under the section it belongs to, A–E; the
                sections sit side by side when the card is wide enough. */}
            <div className={styles.sections}>
              {entry.sections.map((section) => (
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
          </div>
        ))}
      </div>
    </div>
  );
}

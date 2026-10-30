import { useEffect, useState } from "react";
import { Spinner } from "@/shared/components/Spinner";
import { APP_LOCALE, DATE_FORMAT } from "@/shared/lib/format";
import { getSatHistory } from "../api";
import type { SatHistoryEntry } from "../types";
import styles from "./HistoryPage.module.css";

// Questions can earn fractional points (e.g. 3 of 4 checkbox alternatives
// right), so show at most two decimals instead of a long float.
const POINTS_FORMAT = new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 2 });

function percent(score: number, maxScore: number): number {
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

/** A reassessment limited to some sections, rather than the whole bank. */
function isPartial(entry: SatHistoryEntry): boolean {
  return entry.reassessedSections.length > 0;
}

type Tab = "full" | "partial";

function EntryCard({ entry }: { entry: SatHistoryEntry }) {
  return (
    <div className={styles.card}>
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
            <p className={styles.journeyLine}>Reassessed: {entry.reassessedSections.join(", ")}</p>
          )}
        </div>
      )}

      <p className={styles.sumScore}>
        {POINTS_FORMAT.format(entry.sumScore)} / {POINTS_FORMAT.format(entry.sumMaxScore)}
        <span className={styles.sumPercent}>({percent(entry.sumScore, entry.sumMaxScore)}%)</span>
      </p>

      {/* Each module's score under the section it belongs to, A–E. */}
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
  );
}

const EMPTY_TAB_MESSAGE: Record<Tab, string> = {
  full: "You haven't completed a full self-assessment yet.",
  partial: "You haven't completed a partial reassessment yet.",
};

/**
 * Every completed self-assessment, most recent first: a timeline of how
 * a learner's score has evolved, with each attempt's own area breakdown so
 * it's clear what that specific SAT actually covered (relevant if a role
 * change ever changes which questions someone gets). Split into "Full" and
 * "Partial" tabs (a reassessment limited to some sections vs. the whole
 * bank), the same tab pattern as the dashboard's Overview/Detailed view.
 */
export function HistoryPage() {
  const [entries, setEntries] = useState<SatHistoryEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("full");

  useEffect(() => {
    getSatHistory()
      .then((loaded) =>
        setEntries(
          [...loaded].sort(
            (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
          ),
        ),
      )
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

  const shown = entries.filter((entry) => (tab === "partial" ? isPartial(entry) : !isPartial(entry)));

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>History</h1>
      <p className={styles.subheading}>
        Every self-assessment you&apos;ve completed, most recent first.
      </p>

      {loadFailed && <p className={styles.note}>Couldn&apos;t load your history right now. Please try again.</p>}

      {!loadFailed && entries.length === 0 && (
        <p className={styles.note}>
          You haven&apos;t completed a self-assessment yet. Finish one to see it here.
        </p>
      )}

      {!loadFailed && entries.length > 0 && (
        <>
          <div className={styles.tabs} role="tablist" aria-label="History view">
            <button
              type="button"
              role="tab"
              id="tab-full"
              aria-selected={tab === "full"}
              aria-controls="panel-full"
              className={tab === "full" ? styles.tabActive : styles.tab}
              onClick={() => setTab("full")}
            >
              Full assessments
            </button>
            <button
              type="button"
              role="tab"
              id="tab-partial"
              aria-selected={tab === "partial"}
              aria-controls="panel-partial"
              className={tab === "partial" ? styles.tabActive : styles.tab}
              onClick={() => setTab("partial")}
            >
              Partial assessments
            </button>
          </div>

          <div
            id={`panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            className={styles.tabPanel}
          >
            {shown.length === 0 ? (
              <p className={styles.note}>{EMPTY_TAB_MESSAGE[tab]}</p>
            ) : (
              shown.map((entry) => <EntryCard key={entry.instanceNum} entry={entry} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}

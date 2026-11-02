import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { HistoryEntryCard } from "@/shared/components/HistoryEntryCard";
import { Spinner } from "@/shared/components/Spinner";
import { getSatHistory } from "../api";
import type { SatHistoryEntry } from "../types";
import styles from "./HistoryPage.module.css";

/** A reassessment limited to some sections, rather than the whole bank. */
function isPartial(entry: SatHistoryEntry): boolean {
  return entry.reassessedSections.length > 0;
}

type Tab = "full" | "partial";

function EntryCard({ entry }: { entry: SatHistoryEntry }) {
  return (
    <HistoryEntryCard
      heading={`Assessment ${entry.instanceNum}`}
      completedAt={entry.completedAt}
      sumScore={entry.sumScore}
      sumMaxScore={entry.sumMaxScore}
      sections={entry.sections}
      badge={
        (entry.completedJourney || entry.reassessedSections.length > 0) && (
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
        )
      }
    />
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
  const location = useLocation();
  const [entries, setEntries] = useState<SatHistoryEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tab, setTab] = useState<Tab>((location.state as { tab?: Tab } | null)?.tab ?? "full");

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

  const shown = entries.filter((entry) =>
    tab === "partial" ? isPartial(entry) : !isPartial(entry),
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>History</h1>
      <p className={styles.subheading}>
        Every self-assessment you&apos;ve completed, most recent first.
      </p>

      {loadFailed && (
        <p className={styles.note}>Couldn&apos;t load your history right now. Please try again.</p>
      )}

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

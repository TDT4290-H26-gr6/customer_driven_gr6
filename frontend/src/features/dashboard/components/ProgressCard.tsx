import { DATE_FORMAT } from "@/shared/lib/format";
import { progressRows, type ProgressRow } from "../progressRows";
import type { DashboardProgress } from "../types";
import styles from "./ProgressCard.module.css";

function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

function ChangeBadge({ change }: { change: number }) {
  if (change === 0) return <span className={styles.changeSame}>No change</span>;
  const up = change > 0;
  return (
    <span
      className={up ? styles.changeUp : styles.changeDown}
      aria-label={`${up ? "Up" : "Down"} ${Math.abs(change)} percentage points`}
    >
      {up ? "▲" : "▼"} {up ? "+" : "−"}
      {Math.abs(change)} pts
    </span>
  );
}

function Row({ row, comparing }: { row: ProgressRow; comparing: boolean }) {
  return (
    <li className={styles.row}>
      <span className={styles.code} aria-hidden="true">
        {row.code ?? "-"}
      </span>
      <div className={styles.main}>
        <span className={styles.name}>{row.name}</span>

        {!row.assessed ? (
          <span className={styles.muted}>Not assessed yet</span>
        ) : (
          <>
            <span className={styles.values}>
              {comparing && row.change !== null ? (
                <>
                  {row.previousPercent}% → <strong>{row.latestPercent}%</strong>
                  {row.previousLevel !== row.latestLevel && (
                    <span className={styles.level}>
                      {" "}
                      · Level {row.previousLevel ?? "-"} → <strong>{row.latestLevel}</strong>
                    </span>
                  )}
                  {row.previousLevel === row.latestLevel && row.latestLevel && (
                    <span className={styles.level}> · Level {row.latestLevel}</span>
                  )}
                </>
              ) : (
                <>
                  <strong>{row.latestPercent === null ? "-" : `${row.latestPercent}%`}</strong>
                  {row.latestLevel && (
                    <span className={styles.level}> · Level {row.latestLevel}</span>
                  )}
                </>
              )}
            </span>
            {row.carriedFrom !== null && (
              <span className={styles.muted}>
                Not part of your latest assessment — result from Assessment {row.carriedFrom}.
              </span>
            )}
          </>
        )}
      </div>
      {comparing && row.change !== null && <ChangeBadge change={row.change} />}
    </li>
  );
}

/**
 * The dashboard's section-by-section summary. After one assessment: each
 * section's score and level. From a second one on: the previous result →
 * the latest, and the change in percentage points. A section the latest
 * assessment didn't retake shows its last known result and says where it's
 * from, with no change.
 */
export function ProgressCard({ progress }: { progress: DashboardProgress }) {
  const rows = progressRows(progress);
  const { latest, previous } = progress;

  return (
    <section className={styles.card} aria-labelledby="progress-heading">
      <h2 id="progress-heading" className={styles.heading}>
        {previous ? "Your progress" : "Your results by section"}
      </h2>
      <p className={styles.subheading}>
        {previous ? (
          <>
            Assessment {latest.instanceNum} ({formatDate(latest.completedAt)}) compared with
            Assessment {previous.instanceNum} ({formatDate(previous.completedAt)}).
          </>
        ) : (
          <>
            From Assessment {latest.instanceNum} ({formatDate(latest.completedAt)}). Take it again
            later to see how you&apos;ve progressed.
          </>
        )}
      </p>

      <ul className={styles.rows}>
        {rows.map((row) => (
          <Row key={row.id} row={row} comparing={previous !== null} />
        ))}
      </ul>
    </section>
  );
}

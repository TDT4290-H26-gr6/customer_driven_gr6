import { useEffect, useRef, useState } from "react";
import { getSatHistory, type SatHistoryEntry } from "@/features/history";
import { Spinner } from "@/shared/components/Spinner";
import { DATE_FORMAT } from "@/shared/lib/format";
import { SectionLevel } from "./SectionLevel";
import { getSectionCompetenceScores } from "../api";
import { alignForComparison } from "../alignForComparison";
import type { AttemptScores } from "../types";
import styles from "../pages/SectionDetailsPage.module.css";

function percentOf(score: number, maxScore: number): number | null {
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : null;
}

/**
 * The drill-down content itself, with no page chrome (no back button or
 * heading). SectionDetailsPage wraps this for the standalone route, and
 * ResultsPage embeds it directly as its "Detailed view" tab.
 *
 * One tab per completed SAT, Assessment 1 leftmost and the latest selected.
 * Each tab shows that SAT alone: one card per section in A-E order, with
 * its skill level (see SectionLevel) right under the heading, then the
 * per-competence score list. "Compare with" shows the other SAT's score
 * alongside each competence's, as "was% → is%"; the skill level stays
 * about the selected SAT.
 */
export function SectionDetailsView() {
  const [attempts, setAttempts] = useState<SatHistoryEntry[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [scores, setScores] = useState<Map<number, AttemptScores>>(new Map());
  const [compareWith, setCompareWith] = useState<number | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const selectedTab = useRef<HTMLButtonElement>(null);

  // Keep the selected tab visible: the latest is the rightmost, so with
  // many assessments it would otherwise start off-screen.
  useEffect(() => {
    selectedTab.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [selected, attempts]);

  useEffect(() => {
    getSatHistory()
      .then((loaded) => {
        setAttempts(loaded);
        setSelected(loaded[loaded.length - 1]?.instanceNum ?? null);
      })
      .catch(() => {
        setAttempts([]);
        setLoadFailed(true);
      });
  }, []);

  // Load the shown SAT and the one compared with, each only once.
  const requested = useRef(new Set<number>());
  useEffect(() => {
    for (const instanceNum of [selected, compareWith]) {
      if (instanceNum === null || requested.current.has(instanceNum)) continue;
      requested.current.add(instanceNum);
      setLoadFailed(false);
      getSectionCompetenceScores(instanceNum)
        .then((loaded) => {
          if (loaded) setScores((prev) => new Map(prev).set(instanceNum, loaded));
        })
        .catch(() => {
          requested.current.delete(instanceNum); // let a later visit retry
          setLoadFailed(true);
        });
    }
  }, [selected, compareWith]);

  if (attempts === null) {
    return <Spinner />;
  }

  const attempt = attempts.find((a) => a.instanceNum === selected);
  const current = selected === null ? undefined : scores.get(selected);
  const compareAttempt = attempts.find((a) => a.instanceNum === compareWith);
  const compared = compareWith === null ? undefined : scores.get(compareWith);

  function selectTab(instanceNum: number) {
    setSelected(instanceNum);
    // Comparing a SAT with itself shows nothing new.
    if (instanceNum === compareWith) setCompareWith(null);
  }

  return (
    <>
      {attempts.length === 0 && !loadFailed && (
        <p className={styles.note}>No section has been assessed yet.</p>
      )}

      {attempts.length > 0 && (
        <div className={styles.tabs} role="tablist" aria-label="Assessments">
          {/* Oldest first: Assessment 1 on the left, newer ones to the right. */}
          {attempts.map((a) => (
            <button
              key={a.instanceNum}
              ref={a.instanceNum === selected ? selectedTab : undefined}
              type="button"
              role="tab"
              id={`tab-${a.instanceNum}`}
              aria-selected={a.instanceNum === selected}
              aria-controls="attempt-panel"
              className={a.instanceNum === selected ? styles.tabActive : styles.tab}
              onClick={() => selectTab(a.instanceNum)}
            >
              Assessment {a.instanceNum}
            </button>
          ))}
        </div>
      )}

      {loadFailed && (
        <p className={styles.note}>
          Couldn&apos;t load your scores right now. Please try again in a moment.
        </p>
      )}

      {attempt && (
        <div
          id="attempt-panel"
          role="tabpanel"
          aria-labelledby={`tab-${attempt.instanceNum}`}
          className={styles.panel}
        >
          {/* The date on the left, "Compare with" on the same line at the far right. */}
          <div className={styles.attemptHeader}>
            <div className={styles.attemptInfo}>
              <h2 className={styles.attemptTitle}>
                Date taken: {DATE_FORMAT.format(new Date(attempt.completedAt))}
              </h2>
              {attempt.completedJourney && (
                <p className={styles.attemptNote}>
                  After completing <strong>{attempt.completedJourney}</strong>
                </p>
              )}
            </div>

            {attempts.length > 1 && (
              <label className={styles.compare}>
                <span className={styles.compareLabel}>Compare with</span>
                <select
                  className={styles.compareSelect}
                  value={compareWith ?? ""}
                  onChange={(e) => setCompareWith(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="" />
                  {attempts
                    .filter((a) => a.instanceNum !== selected)
                    .map((a) => (
                      <option key={a.instanceNum} value={a.instanceNum}>
                        Assessment {a.instanceNum}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>

          {!current && !loadFailed && <Spinner />}

          {current?.sections.map(({ section, assessed, level, levelCount, competences }) => {
            const other = compared?.sections.find((s) => s.section.id === section.id);
            const overlay = compareAttempt && other?.assessed ? other : undefined;
            const aligned = overlay
              ? alignForComparison(competences, overlay.competences)
              : { main: competences, other: undefined };

            return (
              <section
                key={section.id}
                className={styles.card}
                aria-labelledby={`section-${section.id}`}
              >
                <h3 id={`section-${section.id}`} className={styles.sectionName}>
                  {section.name}
                </h3>
                {assessed && level !== null ? (
                  <SectionLevel level={level} levelCount={levelCount} />
                ) : (
                  <SectionLevel notAssessed />
                )}
                <ul className={styles.competenceList}>
                  {aligned.main.map((c, i) => {
                    const percent = percentOf(c.score, c.maxScore);
                    const otherScore = aligned.other?.[i];
                    const otherPercent =
                      overlay && otherScore
                        ? percentOf(otherScore.score, otherScore.maxScore)
                        : null;

                    return (
                      <li key={c.competence.name} className={styles.competenceRow}>
                        <span className={styles.competenceName}>{c.competence.name}</span>
                        <span className={styles.competenceValue}>
                          {otherPercent !== null && `${otherPercent}% → `}
                          <strong>{percent === null ? "–" : `${percent}%`}</strong>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

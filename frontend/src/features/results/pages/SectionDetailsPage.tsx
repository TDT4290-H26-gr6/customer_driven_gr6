import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSatHistory, type SatHistoryEntry } from "@/features/history";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { DATE_FORMAT } from "@/shared/lib/format";
import { CompetenceRadar } from "../components/CompetenceRadar";
import { SectionLevel } from "../components/SectionLevel";
import { getSectionCompetenceScores } from "../api";
import { alignForComparison } from "../alignForComparison";
import type { AttemptScores, CompetenceScore } from "../types";
import styles from "./SectionDetailsPage.module.css";

/** A radar needs at least three axes; sections with fewer competences are padded with blank ones at 0. */
const MIN_RADAR_AXES = 3;

function withPaddingAxes(competences: CompetenceScore[]): CompetenceScore[] {
  const padding = Array.from({ length: Math.max(0, MIN_RADAR_AXES - competences.length) }, () => ({
    competence: { name: "" },
    score: 0,
    maxScore: 0,
  }));
  return [...competences, ...padding];
}

/**
 * Drill-down from the dashboard: one tab per completed SAT, Assessment 1
 * leftmost and newer ones added to the right (the latest selected, and
 * scrolled into view when the tabs overflow), each headed with its date — and, for a retake after a learning
 * journey, which journey. A tab shows that SAT alone, never merged with
 * others: one radar per section in A–E order, with the learner's skill level
 * in that section (A1 … A4) in a box under it, and "Not assessed yet" for
 * sections that SAT didn't touch. A tab's results load the first time it's
 * opened and are kept for switching back.
 *
 * "Compare with" overlays one other SAT on every section's radar, as a
 * dashed red outline with a legend — purely visual; the level box stays
 * about the selected SAT. Off by default.
 */
export function SectionDetailsPage() {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<SatHistoryEntry[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [scores, setScores] = useState<Map<number, AttemptScores>>(new Map());
  const [compareWith, setCompareWith] = useState<number | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const selectedTab = useRef<HTMLButtonElement>(null);

  // Keep the selected tab visible — the latest is the rightmost, so with
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
    return (
      <div className={styles.page}>
        <Spinner />
      </div>
    );
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
    <div className={styles.page}>
      <Button variant="secondary" className={styles.back} onClick={() => navigate("/results")}>
        ← Back to overview
      </Button>
      <h1 className={styles.heading}>Detailed view</h1>
      <p className={styles.subheading}>How you did in each module, section by section.</p>

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
                {/* Module names are too long for axis labels, so the tips
                    show the module's code (A1, A2, …) and the names are
                    listed under the chart — on every screen size. */}
                <CompetenceRadar
                  data={withPaddingAxes(aligned.main)}
                  compare={aligned.other && withPaddingAxes(aligned.other)}
                  compact
                  tipLabels={aligned.main.map((c) => {
                    const level =
                      c.level ??
                      overlay?.competences.find((o) => o.competence.name === c.competence.name)
                        ?.level;
                    return level ? `${section.code ?? ""}${level}` : null;
                  })}
                />
                {overlay && compareAttempt && (
                  <ul className={styles.compareLegend} aria-label="Chart legend">
                    <li>
                      <span className={styles.swatchMain} aria-hidden="true" />
                      Assessment {attempt.instanceNum}
                    </li>
                    <li>
                      <span className={styles.swatchCompare} aria-hidden="true" />
                      Assessment {compareAttempt.instanceNum}
                    </li>
                  </ul>
                )}
                {assessed && level !== null ? (
                  <SectionLevel code={section.code ?? null} level={level} levelCount={levelCount} />
                ) : (
                  <SectionLevel notAssessed={{ code: section.code ?? null }} />
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

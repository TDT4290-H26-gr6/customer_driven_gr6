import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { MOBILE_QUERY } from "@/shared/lib/breakpoints";
import { CompetenceRadar } from "../components/CompetenceRadar";
import { SectionLevel } from "../components/SectionLevel";
import { getSectionCompetenceScores, getSkillLevels } from "../api";
import type { CompetenceScore, SectionCompetenceScores, SkillLevel } from "../types";
import styles from "./SectionDetailsPage.module.css";

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

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
 * Drill-down from the dashboard: one radar per section, in A–E order,
 * showing the learner's score in each of that section's competences, with
 * their skill level in that section (A1 … A4) in a box under it. Sections
 * they could be assessed in but haven't answered anything in yet are shown
 * too — an empty radar and "Not assessed yet". Each assessed section says
 * when its scores were taken, since a retake only updates the sections it
 * covered, so sections can come from different attempts.
 */
export function SectionDetailsPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [sections, setSections] = useState<SectionCompetenceScores[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // By section id. Empty until loaded, and if it fails — the radars still
  // show, just without the level boxes.
  const [levels, setLevels] = useState<Map<string, SkillLevel>>(new Map());

  useEffect(() => {
    getSectionCompetenceScores()
      .then(setSections)
      .catch(() => {
        setSections([]);
        setLoadFailed(true);
      });
    getSkillLevels()
      .then((loaded) => setLevels(new Map(loaded.map((l) => [l.section.id, l]))))
      .catch(() => setLevels(new Map()));
  }, []);

  if (sections === null) {
    return (
      <div className={styles.page}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Button variant="secondary" className={styles.back} onClick={() => navigate("/results")}>
        ← Back to overview
      </Button>
      <h1 className={styles.heading}>Detailed view</h1>
      <p className={styles.subheading}>How you did in each module, section by section.</p>

      {loadFailed && (
        <p className={styles.note}>
          Couldn&apos;t load your scores right now. Please try again in a moment.
        </p>
      )}
      {!loadFailed && sections.length === 0 && (
        <p className={styles.note}>No section has been assessed yet.</p>
      )}

      {sections.map(({ section, assessed, assessedAt, competences }) => (
        <section key={section.id} className={styles.card} aria-labelledby={`section-${section.id}`}>
          <div className={styles.cardHeader}>
            <h2 id={`section-${section.id}`} className={styles.sectionName}>
              {section.name}
            </h2>
            {assessedAt && (
              <span className={styles.date}>
                Assessed {DATE_FORMAT.format(new Date(assessedAt))}
              </span>
            )}
          </div>
          <CompetenceRadar data={withPaddingAxes(competences)} compact={isMobile} />
          {!assessed ? (
            <SectionLevel notAssessed={{ code: section.code ?? null }} />
          ) : (
            levels.has(section.id) && <SectionLevel skill={levels.get(section.id)!} />
          )}
        </section>
      ))}
    </div>
  );
}

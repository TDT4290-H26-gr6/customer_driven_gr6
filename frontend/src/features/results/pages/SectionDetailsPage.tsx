import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { MOBILE_QUERY } from "@/shared/lib/breakpoints";
import { CompetenceRadar } from "../components/CompetenceRadar";
import { getSectionCompetenceScores } from "../api";
import type { CompetenceScore, SectionCompetenceScores } from "../types";
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
 * Drill-down from the dashboard: one radar per section the learner has been
 * assessed in, showing their score in each of that section's competences.
 * Sections with no scored answers are not listed at all.
 */
export function SectionDetailsPage() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [sections, setSections] = useState<SectionCompetenceScores[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    getSectionCompetenceScores()
      .then(setSections)
      .catch(() => {
        setSections([]);
        setLoadFailed(true);
      });
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
      <p className={styles.subheading}>How you did in each competence, section by section.</p>

      {loadFailed && (
        <p className={styles.note}>
          Couldn&apos;t load your scores right now. Please try again in a moment.
        </p>
      )}
      {!loadFailed && sections.length === 0 && (
        <p className={styles.note}>No section has been assessed yet.</p>
      )}

      {sections.map(({ section, competences }) => (
        <section key={section.id} className={styles.card} aria-labelledby={`section-${section.id}`}>
          <h2 id={`section-${section.id}`} className={styles.sectionName}>
            {section.name}
          </h2>
          <CompetenceRadar data={withPaddingAxes(competences)} compact={isMobile} />
        </section>
      ))}
    </div>
  );
}

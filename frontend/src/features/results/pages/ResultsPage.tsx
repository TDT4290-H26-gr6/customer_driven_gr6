import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { MOBILE_QUERY } from "@/shared/lib/breakpoints";
import { CompetenceRadar } from "../components/CompetenceRadar";
import { WelcomeScreen } from "../components/WelcomeScreen";
import { getSectionCompetenceScores } from "../api";
import { sectionAxes } from "../sectionAxes";
import type { SectionCompetenceScores } from "../types";
import { RecommendedJourneyCard, getRecommendedJourney } from "@/features/learningJourney";
import type { LearningJourney } from "@/features/learningJourney";
import { AdviceCard, getAdvice } from "@/features/advisor";
import { getProgress } from "@/features/assessment";
import type { AdviceState } from "@/features/advisor";
import styles from "./ResultsPage.module.css";

/**
 * The main dashboard: an overview radar with one axis per section (each
 * rolling up that section's own competences — see sectionAxes.ts; a section
 * has too many competences to chart individually here) + entry point into
 * the assessment, the score-based journey recommendation, and AI advice that
 * explains it. The page remounts on every visit, so retaking the SAT and
 * returning here always fetches the fresh scores (and new advice). The
 * assessment button says "Continue" while the learner has an unfinished
 * attempt (left with Save & exit), so they know their answers weren't lost.
 */
export function ResultsPage() {
  const { learner } = useAuth();
  const navigate = useNavigate();
  const [sections, setSections] = useState<SectionCompetenceScores[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [journey, setJourney] = useState<LearningJourney | null>(null);
  // null: no advice to show (no completed assessment, or the feature is off).
  const [advice, setAdvice] = useState<AdviceState | null>({ status: "loading" });
  // null while loading. A failed load falls back to the "start" wording —
  // the runner restores saved answers either way.
  const [hasOngoing, setHasOngoing] = useState<boolean | null>(null);

  useEffect(() => {
    getSectionCompetenceScores()
      .then(setSections)
      .catch(() => {
        setSections([]);
        setLoadFailed(true);
      });
    getProgress()
      .then((progress) => setHasOngoing(progress !== null))
      .catch(() => setHasOngoing(false));
    getRecommendedJourney()
      .then(setJourney)
      .catch(() => setJourney(null));
    // Slower than the rest (an LLM call the first time), so it fills in on
    // its own instead of holding up the page.
    getAdvice()
      .then((loaded) => setAdvice(loaded ? { status: "ready", advice: loaded } : null))
      .catch(() => setAdvice({ status: "unavailable" }));
  }, []);

  if (sections === null || hasOngoing === null) {
    return (
      <div className={styles.page}>
        <Spinner />
      </div>
    );
  }

  if (!learner?.hasCompletedInitialAssessment) {
    return (
      <WelcomeScreen
        name={learner?.name}
        hasOngoing={hasOngoing}
        onStart={() => navigate("/assessment")}
      />
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Welcome{learner?.name ? `, ${learner.name}` : ""}</h1>
      <p className={styles.subheading}>Here&apos;s where your skills stand right now.</p>

      <div className={styles.chartCard}>
        {loadFailed ? (
          <p className={styles.note}>
            Couldn&apos;t load your scores right now. Please try again in a moment.
          </p>
        ) : (
          <CompetenceRadar data={sectionAxes(sections)} compact={isMobile} />
        )}
        {!loadFailed && (
          <Button
            variant="secondary"
            className={styles.details}
            onClick={() => navigate("/results/details")}
          >
            More details
          </Button>
        )}
      </div>

      {journey && <RecommendedJourneyCard journey={journey} />}

      {advice && <AdviceCard state={advice} />}

      <Button className={styles.cta} onClick={() => navigate("/assessment")}>
        {hasOngoing ? "Continue assessment" : "Assess yourself"}
      </Button>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { MOBILE_QUERY } from "@/shared/lib/breakpoints";
import { CompetenceRadar } from "../components/CompetenceRadar";
import { WelcomeScreen } from "../components/WelcomeScreen";
import { getCompetenceScores } from "../api";
import type { CompetenceScore } from "../types";
import { RecommendedJourneyCard, getRecommendedJourney } from "@/features/learningJourney";
import type { LearningJourney } from "@/features/learningJourney";
import styles from "./ResultsPage.module.css";

/**
 * The main dashboard: radar chart of the learner's latest SAT competence
 * scores + entry point into the assessment. The page remounts on every visit,
 * so retaking the SAT and returning here always fetches the fresh scores.
 */
export function ResultsPage() {
  const { learner } = useAuth();
  const navigate = useNavigate();
  const [scores, setScores] = useState<CompetenceScore[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [journey, setJourney] = useState<LearningJourney | null>(null);

  useEffect(() => {
    getCompetenceScores()
      .then(setScores)
      .catch(() => {
        setScores([]);
        setLoadFailed(true);
      });
    getRecommendedJourney()
      .then(setJourney)
      .catch(() => setJourney(null));
  }, []);

  if (scores === null) {
    return (
      <div className={styles.page}>
        <Spinner />
      </div>
    );
  }

  if (!learner?.hasCompletedInitialAssessment) {
    return <WelcomeScreen name={learner?.name} onStart={() => navigate("/assessment")} />;
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
          <CompetenceRadar data={scores} compact={isMobile} />
        )}
      </div>

      {journey && <RecommendedJourneyCard journey={journey} />}

      <Button className={styles.cta} onClick={() => navigate("/assessment")}>
        Assess yourself
      </Button>
    </div>
  );
}

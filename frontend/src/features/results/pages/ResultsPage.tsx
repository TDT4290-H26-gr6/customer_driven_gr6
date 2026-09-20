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
import styles from "./ResultsPage.module.css";

// Shown while GET /competence-scores isn't implemented on the backend yet.
const PLACEHOLDER_SCORES: CompetenceScore[] = [
  { competenceArea: { name: "AI Literacy" }, score: 3, maxScore: 5 },
  { competenceArea: { name: "Open Science" }, score: 2, maxScore: 5 },
  { competenceArea: { name: "Data Management" }, score: 4, maxScore: 5 },
  { competenceArea: { name: "Prompting" }, score: 3, maxScore: 5 },
  { competenceArea: { name: "Critical Evaluation" }, score: 2, maxScore: 5 },
  { competenceArea: { name: "Ethics & Bias" }, score: 4, maxScore: 5 },
];

/** The main dashboard: skill radar chart + entry point into the assessment. */
export function ResultsPage() {
  const { learner } = useAuth();
  const navigate = useNavigate();
  const [scores, setScores] = useState<CompetenceScore[] | null>(null);
  const [isPlaceholder, setIsPlaceholder] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  useEffect(() => {
    getCompetenceScores()
      .then(setScores)
      .catch(() => {
        setScores(PLACEHOLDER_SCORES);
        setIsPlaceholder(true);
      });
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
        <CompetenceRadar data={scores} compact={isMobile} />
        {isPlaceholder && (
          <p className={styles.note}>Sample data — real scoring isn&apos;t available yet.</p>
        )}
      </div>

      <Button className={styles.cta} onClick={() => navigate("/assessment")}>
        Assess yourself
      </Button>
    </div>
  );
}

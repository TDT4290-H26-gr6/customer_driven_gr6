import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { JourneyCard } from "../components/JourneyCard";
import { listJourneys, startJourneyAssessment } from "../api";
import type { LearningJourney } from "../types";
import styles from "./LearningJourneysPage.module.css";

/**
 * Every learning journey, listed like the Sources page (the customer's
 * request): a grid of cards, one expanded at a time. Each can be assessed on
 * its own — only the questions in the sections it's centred on (M) — which
 * never overrides or compares with the main self-assessment; the result
 * shows under Competencies.
 */
export function LearningJourneysPage() {
  const navigate = useNavigate();
  const [journeys, setJourneys] = useState<LearningJourney[] | null>(null);
  // Kept apart from an empty list: "couldn't load" and "there are none" are
  // different messages, and only the first is worth retrying.
  const [loadFailed, setLoadFailed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<{ message: string; inProgress: boolean } | null>(
    null,
  );

  const load = useCallback(() => {
    setLoadFailed(false);
    setJourneys(null);
    listJourneys()
      .then(setJourneys)
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleAssess(id: string) {
    setStartingId(id);
    setStartError(null);
    startJourneyAssessment(id)
      .then(() => navigate("/assessment"))
      .catch((err) => {
        const inProgress = isApiError(err) && err.status === 409;
        setStartError({
          message: inProgress
            ? "You have an assessment in progress. Finish or abort it before assessing a journey."
            : isApiError(err) && err.status === 400
              ? err.message
              : "Couldn't start the assessment. Try again.",
          inProgress,
        });
        setStartingId(null);
      });
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Learning journeys</h1>
      <p className={styles.subheading}>
        Assess yourself on any journey, only the sections it focuses on. It doesn&apos;t change your
        self-assessment; your result shows under Competencies.
      </p>

      {startError && (
        <div className={styles.alert} role="alert">
          <p className={styles.alertText}>{startError.message}</p>
          {startError.inProgress && (
            <Button variant="secondary" onClick={() => navigate("/assessment")}>
              Continue assessment
            </Button>
          )}
        </div>
      )}

      {loadFailed ? (
        <div className={styles.failed}>
          <p className={styles.error} role="alert">
            Couldn&apos;t load the journeys. Check your connection and try again.
          </p>
          <Button variant="secondary" onClick={load}>
            Try again
          </Button>
        </div>
      ) : journeys === null ? (
        <Spinner />
      ) : journeys.length === 0 ? (
        <p className={styles.empty}>No learning journeys are available yet.</p>
      ) : (
        <div className={styles.grid}>
          {journeys.map((journey, index) => (
            <JourneyCard
              key={journey.id}
              journey={journey}
              index={index}
              expanded={expandedId === journey.id}
              onToggle={() => setExpandedId((id) => (id === journey.id ? null : journey.id))}
              onAssess={() => handleAssess(journey.id)}
              starting={startingId === journey.id}
              assessDisabled={
                startingId !== null ||
                !(journey.sections ?? []).some((s) => s.coverageLevel === "M")
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

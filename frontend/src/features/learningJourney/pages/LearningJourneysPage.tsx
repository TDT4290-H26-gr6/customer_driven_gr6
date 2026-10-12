import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { listJourneys, startJourneyAssessment } from "../api";
import type { LearningJourney } from "../types";
import styles from "./LearningJourneysPage.module.css";

/** The sections a journey is centred on (M) — what assessing it covers. */
function coreSections(journey: LearningJourney) {
  return (journey.sections ?? [])
    .filter((s) => s.coverageLevel === "M")
    .map((s) => s.section?.code ?? s.section?.name ?? "")
    .filter(Boolean)
    .sort();
}

/**
 * Browse every learning journey and assess yourself on one of them: an
 * assessment with only the questions in the sections the journey is centred
 * on (M). It stands on its own — it never overrides or compares with the
 * main self-assessment, and its result shows under Competencies.
 */
export function LearningJourneysPage() {
  const navigate = useNavigate();
  const [journeys, setJourneys] = useState<LearningJourney[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<{ message: string; inProgress: boolean } | null>(
    null,
  );

  useEffect(() => {
    listJourneys()
      .then(setJourneys)
      .catch(() => {
        setJourneys([]);
        setLoadFailed(true);
      });
  }, []);

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

  if (journeys === null) {
    return (
      <div className={styles.page}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Learning journeys</h1>
      <p className={styles.subheading}>
        Assess yourself on any journey — only the sections it focuses on. It doesn&apos;t change
        your self-assessment; your result shows under Competencies.
      </p>

      {loadFailed && (
        <p className={styles.note}>Couldn&apos;t load the journeys right now. Please try again.</p>
      )}

      {!loadFailed && journeys.length === 0 && (
        <p className={styles.note}>No learning journeys are available yet.</p>
      )}

      {startError && (
        <div className={styles.error} role="alert">
          {startError.message}{" "}
          {startError.inProgress && (
            <Button variant="secondary" onClick={() => navigate("/assessment")}>
              Continue assessment
            </Button>
          )}
        </div>
      )}

      {journeys.map((journey) => {
        const sections = coreSections(journey);
        return (
          <div key={journey.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardHeading}>{journey.name}</h2>
            </div>

            {journey.description && <p className={styles.description}>{journey.description}</p>}

            {journey.modules.length > 0 && (
              <ol className={styles.modules}>
                {journey.modules.map((module) => (
                  <li key={module.id} className={styles.module}>
                    <span className={styles.moduleTitle}>{module.title}</span>
                    {module.description && (
                      <span className={styles.moduleDescription}>{module.description}</span>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {sections.length > 0 && (
              <p className={styles.covers}>Assesses sections {sections.join(", ")}</p>
            )}

            {journey.moodleUrl && (
              <a
                className={styles.moodleLink}
                href={journey.moodleUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Moodle ↗
              </a>
            )}
            <Button
              variant="secondary"
              className={styles.selectButton}
              onClick={() => handleAssess(journey.id)}
              disabled={startingId !== null || sections.length === 0}
            >
              {startingId === journey.id ? "Starting…" : "Assess this journey"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

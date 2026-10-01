import { useEffect, useState } from "react";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { listJourneys, getSelectedJourney, selectJourney } from "../api";
import type { LearningJourney } from "../types";
import styles from "./LearningJourneysPage.module.css";

/**
 * Browse every learning journey and pick one to follow (CD-33) — not just
 * the one score-based recommendation. The selection sticks (Learner.
 * selectedJourneyId) and is what the results page then shows as "your
 * journey", overriding the recommendation, until a different one is picked.
 */
export function LearningJourneysPage() {
  const [journeys, setJourneys] = useState<LearningJourney[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [selectError, setSelectError] = useState("");

  useEffect(() => {
    Promise.all([listJourneys(), getSelectedJourney()])
      .then(([loaded, selected]) => {
        setJourneys(loaded);
        setSelectedId(selected?.id ?? null);
      })
      .catch(() => {
        setJourneys([]);
        setLoadFailed(true);
      });
  }, []);

  function handleSelect(id: string) {
    setSelectingId(id);
    setSelectError("");
    selectJourney(id)
      .then((journey) => setSelectedId(journey.id))
      .catch(() => setSelectError("Couldn't save your choice. Try again."))
      .finally(() => setSelectingId(null));
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
        Browse every journey and pick the one you want to follow — it doesn&apos;t have to be the
        one recommended for you.
      </p>

      {loadFailed && (
        <p className={styles.note}>Couldn&apos;t load the journeys right now. Please try again.</p>
      )}

      {!loadFailed && journeys.length === 0 && (
        <p className={styles.note}>No learning journeys are available yet.</p>
      )}

      {selectError && <p className={styles.error}>{selectError}</p>}

      {journeys.map((journey) => {
        const isSelected = journey.id === selectedId;
        return (
          <div key={journey.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardHeading}>{journey.name}</h2>
              {isSelected && <span className={styles.badge}>Selected</span>}
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

            <Button
              variant="secondary"
              className={styles.selectButton}
              onClick={() => handleSelect(journey.id)}
              disabled={isSelected || selectingId === journey.id}
            >
              {isSelected
                ? "Currently selected"
                : selectingId === journey.id
                  ? "Selecting…"
                  : "Select this journey"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

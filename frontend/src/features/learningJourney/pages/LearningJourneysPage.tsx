import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { JourneyCard } from "../components/JourneyCard";
import { JourneyModal } from "../components/JourneyModal";
import { listJourneys, startJourneyAssessment } from "../api";
import type { LearningJourney } from "../types";
import styles from "./LearningJourneysPage.module.css";

/**
 * Every learning journey, listed like the Sources page (the customer's
 * request): a grid of cards; clicking one opens its details in a modal. Each can be assessed on
 * its own — only the questions in the sections it's centred on (M) — which
 * never overrides or compares with the main self-assessment; the result
 * shows under Competencies.
 */
export function LearningJourneysPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [journeys, setJourneys] = useState<LearningJourney[] | null>(null);
  // Kept apart from an empty list: "couldn't load" and "there are none" are
  // different messages, and only the first is worth retrying.
  const [loadFailed, setLoadFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // Whatever had focus when a modal opened (the card), so closing returns there.
  const opener = useRef<Element | null>(null);
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

  // Arriving from elsewhere (e.g. the Competencies page's "Assess this
  // journey") can ask for a specific journey's modal to open straight away.
  // Cleared from history once applied, so it doesn't reopen on back/forward.
  useEffect(() => {
    const openJourneyId = (location.state as { openJourneyId?: string } | null)?.openJourneyId;
    if (!openJourneyId || !journeys?.some((j) => j.id === openJourneyId)) return;
    setOpenId(openJourneyId);
    navigate(location.pathname, { replace: true, state: null });
  }, [journeys, location.state, location.pathname, navigate]);

  /** Any assessment is starting, or the journey has no core (M) sections to assess. */
  const assessDisabled = (journey: LearningJourney) =>
    startingId !== null || !(journey.sections ?? []).some((s) => s.coverageLevel === "M");
  const selected = journeys?.find((j) => j.id === openId) ?? null;

  function openJourney(id: string) {
    opener.current = document.activeElement;
    setOpenId(id);
  }

  function closeJourney() {
    setOpenId(null);
    (opener.current as HTMLElement | null)?.focus();
  }

  function handleAssess(id: string) {
    // The alert for a failed start is on the page, so don't leave the modal over it.
    setOpenId(null);
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
              onOpen={() => openJourney(journey.id)}
              onAssess={() => handleAssess(journey.id)}
              starting={startingId === journey.id}
              assessDisabled={assessDisabled(journey)}
            />
          ))}
        </div>
      )}

      {selected && (
        <JourneyModal
          journey={selected}
          index={journeys!.indexOf(selected)}
          onClose={closeJourney}
          onAssess={() => handleAssess(selected.id)}
          starting={startingId === selected.id}
          assessDisabled={assessDisabled(selected)}
        />
      )}
    </div>
  );
}

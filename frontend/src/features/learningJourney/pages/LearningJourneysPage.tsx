import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { HistoryEntryCard } from "@/shared/components/HistoryEntryCard";
import { Spinner } from "@/shared/components/Spinner";
import { JourneyCard } from "../components/JourneyCard";
import { JourneyModal } from "../components/JourneyModal";
import { getJourneyHistory, listJourneys, startJourneyAssessment } from "../api";
import type { JourneyHistoryEntry, LearningJourney } from "../types";
import styles from "./LearningJourneysPage.module.css";

type Tab = "overview" | "history";

/** One past attempt at assessing a single journey, the same card shape as HistoryPage's. */
function JourneyHistoryCard({ entry }: { entry: JourneyHistoryEntry }) {
  return (
    <HistoryEntryCard
      heading={entry.journeyName ?? "Removed journey"}
      completedAt={entry.completedAt}
      sumScore={entry.sumScore}
      sumMaxScore={entry.sumMaxScore}
      sections={entry.sections}
    />
  );
}

/**
 * Every learning journey, listed like the Sources page (the customer's
 * request): a grid of cards; clicking one opens its details in a modal. Each can be assessed on
 * its own, only the questions in the sections it's centred on (M), which
 * never overrides or compares with the main self-assessment. Split into
 * "Overview" (the journey cards) and "History" (every past attempt, the
 * same layout as the main SAT's History page) tabs.
 */
export function LearningJourneysPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>((location.state as { tab?: Tab } | null)?.tab ?? "overview");
  const [journeys, setJourneys] = useState<LearningJourney[] | null>(null);
  // Kept apart from an empty list: "couldn't load" and "there are none" are
  // different messages, and only the first is worth retrying.
  const [loadFailed, setLoadFailed] = useState(false);
  const [history, setHistory] = useState<JourneyHistoryEntry[] | null>(null);
  const [historyLoadFailed, setHistoryLoadFailed] = useState(false);
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

  const loadHistory = useCallback(() => {
    setHistoryLoadFailed(false);
    setHistory(null);
    getJourneyHistory()
      .then((loaded) =>
        setHistory(
          [...loaded].sort(
            (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
          ),
        ),
      )
      .catch(() => {
        setHistory([]);
        setHistoryLoadFailed(true);
      });
  }, []);

  useEffect(() => {
    load();
    loadHistory();
  }, [load, loadHistory]);

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
        self-assessment; your best result still rolls into Competencies, and every attempt is listed
        on the History tab below.
      </p>

      <div className={styles.tabs} role="tablist" aria-label="Learning journeys view">
        <button
          type="button"
          role="tab"
          id="tab-overview"
          aria-selected={tab === "overview"}
          aria-controls="panel-overview"
          className={tab === "overview" ? styles.tabActive : styles.tab}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          id="tab-history"
          aria-selected={tab === "history"}
          aria-controls="panel-history"
          className={tab === "history" ? styles.tabActive : styles.tab}
          onClick={() => setTab("history")}
        >
          History
        </button>
      </div>

      {tab === "overview" && (
        <div
          id="panel-overview"
          role="tabpanel"
          aria-labelledby="tab-overview"
          className={styles.tabPanel}
        >
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
        </div>
      )}

      {tab === "history" && (
        <div
          id="panel-history"
          role="tabpanel"
          aria-labelledby="tab-history"
          className={styles.tabPanel}
        >
          {historyLoadFailed ? (
            <div className={styles.failed}>
              <p className={styles.error} role="alert">
                Couldn&apos;t load your journey history. Check your connection and try again.
              </p>
              <Button variant="secondary" onClick={loadHistory}>
                Try again
              </Button>
            </div>
          ) : history === null ? (
            <Spinner />
          ) : history.length === 0 ? (
            <p className={styles.empty}>
              You haven&apos;t assessed a learning journey on its own yet.
            </p>
          ) : (
            history.map((entry) => <JourneyHistoryCard key={entry.instanceNum} entry={entry} />)
          )}
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

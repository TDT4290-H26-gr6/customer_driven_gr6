import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { MOBILE_QUERY } from "@/shared/lib/breakpoints";
import { CompetenceRadar } from "../components/CompetenceRadar";
import { ProgressCard } from "../components/ProgressCard";
import { WelcomeScreen } from "../components/WelcomeScreen";
import { getDashboardProgress } from "../api";
import { radarAxes } from "../progressRows";
import type { DashboardProgress } from "../types";
import {
  RecommendedJourneys,
  WeakCompetencesSection,
  getRecommendedJourneys,
  getWeakCompetences,
} from "@/features/learningJourney";
import type {
  RankedJourney,
  RecommendedJourneysResult,
  WeakCompetence,
} from "@/features/learningJourney";
import { AdviceCard, getAdvice } from "@/features/advisor";
import { getProgress } from "@/features/assessment";
import type { AdviceState } from "@/features/advisor";
import styles from "./ResultsPage.module.css";

/**
 * The main dashboard, shown only once a first assessment has been submitted:
 * an overview radar with one axis per section (each rolling up that
 * section's own competences; a section has too many competences to chart
 * individually here), a section-by-section summary (ProgressCard), the
 * two recommended learning journeys (the AI advisor's ranking on scores and
 * profile, the best fit highlighted — else the score-based top two, see
 * getRecommendedJourneys), every competence at or below 60% paired with the
 * journey for it (CD-90), AI advice that explains it, and the entry point into
 * the assessment. From a second
 * assessment on, the radar overlays the previous one and the summary shows
 * the change — always the latest two; older ones are in History and "See
 * results by section". The page remounts on every visit, so retaking the
 * SAT and returning here always fetches the fresh scores (and new advice). The
 * assessment button says "Continue" while the learner has an unfinished
 * attempt (left with Save & exit), so they know their answers weren't lost;
 * otherwise "Retake assessment", which first asks about completed learning journeys
 * (ReassessPage). A section the latest assessment didn't retake keeps its
 * last known result, so a reassessment of some sections keeps the others on
 * the radar.
 *
 * A new learner fills in their profile first: until they've both completed
 * it and finished a first assessment, this sends them to /profile, whose
 * "Done" brings them back to the welcome screen here.
 */
export function ResultsPage() {
  const { learner } = useAuth();
  const navigate = useNavigate();
  // undefined while loading; null before any completed assessment.
  const [progress, setProgress] = useState<DashboardProgress | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  // The score-based top two; null while loading or when there are none.
  const [scoreJourneys, setScoreJourneys] = useState<RecommendedJourneysResult | null>(null);
  // null while loading; [] once loaded means every competence is sufficient.
  const [weakCompetences, setWeakCompetences] = useState<WeakCompetence[] | null>(null);
  // null: no advice to show (no completed assessment, or the feature is off).
  const [advice, setAdvice] = useState<AdviceState | null>({ status: "loading" });
  // null while loading. A failed load falls back to the "start" wording —
  // the runner restores saved answers either way.
  const [hasOngoing, setHasOngoing] = useState<boolean | null>(null);

  useEffect(() => {
    // The latest SAT and the one before it — older ones are in History and
    // "See results by section".
    getDashboardProgress()
      .then(setProgress)
      .catch(() => {
        setProgress(null);
        setLoadFailed(true);
      });
    getProgress()
      .then((progress) => setHasOngoing(progress !== null))
      .catch(() => setHasOngoing(false));
    getRecommendedJourneys()
      .then(setScoreJourneys)
      .catch(() => setScoreJourneys(null));
    getWeakCompetences()
      .then(setWeakCompetences)
      .catch(() => setWeakCompetences(null));
    // Slower than the rest (an LLM call the first time), so it fills in on
    // its own instead of holding up the page.
    getAdvice()
      .then((loaded) => setAdvice(loaded ? { status: "ready", advice: loaded } : null))
      .catch(() => setAdvice({ status: "unavailable" }));
  }, []);

  // The recommended journeys: the AI advisor's ranking (scores + profile,
  // with reasons) once the advice has loaded; until then, or when the
  // advisor is off or fails, the score-based top two. Either way the label
  // ("Recommended for you" / "To keep improving") follows the scores, since
  // the advisor ranks among the same journeys.
  const aiRanked: RankedJourney[] = advice?.status === "ready" ? advice.advice.journeys : [];
  // Two whenever two exist: an AI ranking with fewer (advice saved before
  // ranking, which had one) is topped up from the score-based order.
  const scoreRanked: RankedJourney[] = (scoreJourneys?.journeys ?? []).map((journey) => ({
    journey,
    reason: null,
  }));
  const ranked: RankedJourney[] = [
    ...aiRanked,
    ...scoreRanked.filter((s) => !aiRanked.some((a) => a.journey.id === s.journey.id)),
  ].slice(0, 2);
  const journeySource = scoreJourneys?.source ?? "recommended";

  if (!learner?.hasCompletedInitialAssessment && !learner?.hasCompletedProfile) {
    return <Navigate to="/profile" replace />;
  }

  if (progress === undefined || hasOngoing === null) {
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
      <p className={styles.subheading}>
        {progress?.previous
          ? "Here's where your skills stand now, and how they've changed since last time."
          : "Here's where your skills stand right now."}
      </p>

      <div className={styles.chartCard}>
        {loadFailed || !progress ? (
          <p className={styles.note}>
            Couldn&apos;t load your scores right now. Please try again in a moment.
          </p>
        ) : (
          <>
            <CompetenceRadar
              data={radarAxes(progress, "latest")}
              compare={progress.previous ? radarAxes(progress, "previous") : undefined}
              compact={isMobile}
            />
            {progress.previous && (
              <ul className={styles.legend} aria-label="Chart legend">
                <li>
                  <span className={styles.swatchLatest} aria-hidden="true" />
                  Assessment {progress.latest.instanceNum} (latest)
                </li>
                <li>
                  <span className={styles.swatchPrevious} aria-hidden="true" />
                  Assessment {progress.previous.instanceNum}
                </li>
              </ul>
            )}
          </>
        )}
        {!loadFailed && progress && (
          <Button
            variant="secondary"
            className={styles.details}
            onClick={() => navigate("/results/details")}
          >
            See results by section
          </Button>
        )}
      </div>

      {!loadFailed && progress && <ProgressCard progress={progress} />}

      {ranked.length > 0 && <RecommendedJourneys ranked={ranked} source={journeySource} />}

      {weakCompetences && <WeakCompetencesSection competences={weakCompetences} />}

      {advice && <AdviceCard state={advice} />}

      <Button
        className={styles.cta}
        onClick={() => navigate(hasOngoing ? "/assessment" : "/assessment/reassess")}
      >
        {hasOngoing ? "Continue assessment" : "Retake assessment"}
      </Button>
    </div>
  );
}

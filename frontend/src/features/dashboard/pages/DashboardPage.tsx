import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { MOBILE_QUERY } from "@/shared/lib/breakpoints";
import { CompetenceRadar } from "../components/CompetenceRadar";
import { ProgressCard } from "../components/ProgressCard";
import { SectionDetailsView } from "../components/SectionDetailsView";
import { WelcomeScreen } from "../components/WelcomeScreen";
import { getDashboardProgress } from "../api";
import { radarAxes } from "../progressRows";
import type { DashboardProgress } from "../types";
import { RecommendedJourneys, getRecommendedJourneys } from "@/features/learningJourney";
import type { RankedJourney, RecommendedJourneysResult } from "@/features/learningJourney";
import { AdviceCard, getAdvice } from "@/features/advisor";
import { getProgress } from "@/features/assessment";
import type { AdviceState } from "@/features/advisor";
import styles from "./DashboardPage.module.css";

/**
 * The main dashboard, shown once a first assessment is submitted, as two
 * tabs. "Overview": the radar next to a section-by-section summary
 * (ProgressCard), the two recommended learning journeys, AI advice, and the
 * entry point into the assessment. From a second assessment on, the radar
 * overlays the previous one and the summary shows the change (always the
 * latest two). "Detailed view": the per-assessment, per-competence
 * drill-down (SectionDetailsView), also reachable on its own at
 * /dashboard/details.
 *
 * A new learner fills in their profile first: until they've completed it
 * and a first assessment, this sends them to /profile, whose "Done" brings
 * them back here.
 */
export function DashboardPage() {
  const { learner } = useAuth();
  const navigate = useNavigate();
  // undefined while loading; null before any completed assessment.
  const [progress, setProgress] = useState<DashboardProgress | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  // The score-based top two; null while loading or when there are none.
  const [scoreJourneys, setScoreJourneys] = useState<RecommendedJourneysResult | null>(null);
  // null: no advice to show (no completed assessment, or the feature is off).
  const [advice, setAdvice] = useState<AdviceState | null>({ status: "loading" });
  // null while loading. A failed load falls back to the "start" wording;
  // the runner restores saved answers either way.
  const [hasOngoing, setHasOngoing] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"overview" | "details">("overview");

  useEffect(() => {
    // The latest SAT and the one before it; older ones are in History and
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
    // data-backdrop: the decorative logo-color background behind the cards (AppShell.module.css).
    <div className={styles.page} data-backdrop="logo">
      {/* The button sits to the right, centred on the heading + subheading together. */}
      <div className={styles.titleRow}>
        <div className={styles.titleText}>
          <h1 className={styles.heading}>Welcome{learner?.name ? `, ${learner.name}` : ""}</h1>
          <p className={styles.subheading}>
            {progress?.previous
              ? "Here's where your skills stand now, and how they've changed since last time."
              : "Here's where your skills stand right now."}
          </p>
        </div>
        <Button
          className={styles.cta}
          onClick={() => navigate(hasOngoing ? "/assessment" : "/assessment/reassess")}
        >
          {hasOngoing ? "Continue assessment" : "Retake assessment"}
        </Button>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Dashboard view">
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
          id="tab-details"
          aria-selected={tab === "details"}
          aria-controls="panel-details"
          className={tab === "details" ? styles.tabActive : styles.tab}
          onClick={() => setTab("details")}
        >
          Detailed view
        </button>
      </div>

      {tab === "overview" && (
        <div
          id="panel-overview"
          role="tabpanel"
          aria-labelledby="tab-overview"
          className={styles.tabPanel}
        >
          <p className={styles.note}>
            Based on your full self-assessments. A partial reassessment (limited to some sections)
            isn&apos;t reflected here. See Detailed view for those.
          </p>
          <div className={styles.topRow}>
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
            </div>

            {!loadFailed && progress && (
              <div className={styles.sectionCard}>
                <ProgressCard progress={progress} />
              </div>
            )}
          </div>

          {ranked.length > 0 && <RecommendedJourneys ranked={ranked} source={journeySource} />}

          {advice && <AdviceCard state={advice} />}
        </div>
      )}

      {tab === "details" && (
        <div
          id="panel-details"
          role="tabpanel"
          aria-labelledby="tab-details"
          className={styles.tabPanel}
        >
          <SectionDetailsView />
        </div>
      )}
    </div>
  );
}

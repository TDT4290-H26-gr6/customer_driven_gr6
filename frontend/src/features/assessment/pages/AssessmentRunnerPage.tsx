import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { completeInitialAssessment } from "@/features/auth";
import { isApiError } from "@/shared/api/client";
import { withRetry } from "@/shared/api/retry";
import { Button } from "@/shared/components/Button";
import { CloseIcon, HelpIcon } from "@/shared/components/icons";
import { Spinner } from "@/shared/components/Spinner";
import { useLocalStorage } from "@/shared/hooks/useLocalStorage";
import { assessmentGuideSteps } from "../assessmentGuide";
import { AssessmentGuide } from "../components/AssessmentGuide";
import { AssessmentProgress } from "../components/AssessmentProgress";
import { ExitAssessmentDialog, type ExitStatus } from "../components/ExitAssessmentDialog";
import { QuestionCard } from "../components/QuestionCard";
import type { PieAnswer } from "../components/PieQuestionPlayer";
import {
  completeAssessment,
  discardAssessment,
  getAssessmentPath,
  recordQuestionView,
  saveResponse,
} from "../api";
import type { AssessmentPath } from "../types";
import styles from "./AssessmentRunnerPage.module.css";

/** The saved answers on a path, keyed by question id. */
function answersOf(path: AssessmentPath): Record<string, PieAnswer> {
  return Object.fromEntries(
    path.items.flatMap((item) => (item.answer ? [[item.question.id, item.answer]] : [])),
  );
}

/**
 * Runs the adaptive assessment one question at a time. The backend decides
 * the route (assessment.path.ts): sections in a random order, levels 1 → 4
 * within each, every question of a level asked, moving up a level at 2 of 3
 * right and on to the next section as soon as that's out of reach. So the page doesn't hold the whole question list, it
 * holds the path so far (answered questions + the next one) and refetches it
 * after every Next. Answered questions are history: Back revisits them and
 * changing an answer only changes its score, which question comes next is
 * decided from where the learner is now, so only answering beyond what's
 * been shown changes the questions.
 *
 * Each answer is saved to the backend as it changes (CD-7 / SAT2 save &
 * resume); opening the page again resumes at the next question. Finishing
 * marks the SAT instance complete (which rolls its answers up into the
 * competence scores the dashboard shows) and flags the learner as having
 * completed the initial assessment.
 *
 * Nothing fails silently: a failed load offers a retry; a save that still
 * fails after retrying is kept as "unsaved" with a banner to retry it, and
 * Next/Finish wait for every answer to be saved (the path and the scores
 * would otherwise be computed without it). A save rejected with 404 means
 * the question is no longer visible to the learner's role (an admin changed
 * it mid-assessment), retrying can't help, so the path is reloaded instead.
 *
 * Exit opens a dialog: "Save & exit" leaves once every answer is saved (the
 * learner resumes later); "Abort" deletes the in-progress instance and all
 * its answers. Abort first stops queued saves and waits for the one in
 * flight, a save landing after the delete would otherwise create a new
 * instance holding just that answer.
 *
 * A step-by-step guide to the page (AssessmentGuide) opens by itself the
 * first time a learner starts their first, full self-assessment, and from
 * the ? button in any assessment. Whether it has been seen is remembered per
 * learner in this browser, so it never opens by itself twice.
 */
export function AssessmentRunnerPage() {
  const [path, setPath] = useState<AssessmentPath | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, PieAnswer>>({});
  const [isMoving, setIsMoving] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);
  const [questionsRemoved, setQuestionsRemoved] = useState(false);
  // Saves run one after another, in the order the learner made them, and
  // Next/Finish wait for the queue, the next question depends on the
  // answer, and a save still in flight when the instance is completed would
  // create a brand-new instance for that answer.
  const pendingSaves = useRef<Promise<unknown>>(Promise.resolve());
  // Latest answer (and the elapsed time recorded when it was first queued,
  // CD-97, a retry reuses it rather than the time since the retry, which
  // could be much later) per question whose save failed. A ref (read right
  // after awaiting the queue), mirrored into state for rendering.
  const unsaved = useRef(new Map<string, { answer: PieAnswer; timeSpentMs?: number }>());
  const [unsavedCount, setUnsavedCount] = useState(0);
  // Set while an abort is deleting the instance: queued saves are skipped
  // (kept as unsaved in case the delete fails) instead of recreating it.
  const discarding = useRef(false);
  // Set while Finish completes the instance, for the same reason: the PIE
  // player can re-emit the current answer, and a save landing just after
  // completion would start a brand-new (full) instance for it.
  const finishing = useRef(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitStatus, setExitStatus] = useState<ExitStatus>("idle");
  const [exitError, setExitError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { learner, markInitialAssessmentComplete } = useAuth();
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideSeen, setGuideSeen] = useLocalStorage(
    `aios.assessmentGuideSeen.${learner?.id ?? "unknown"}`,
    false,
  );

  // The guide opens by itself only for the first, full self-assessment, once
  // it's loaded and has a question to show.
  const isFirstAssessment =
    path !== null &&
    path.items.length > 0 &&
    path.journey === null &&
    !path.partial &&
    learner != null &&
    !learner.hasCompletedInitialAssessment;
  useEffect(() => {
    if (isFirstAssessment && !guideSeen) setGuideOpen(true);
  }, [isFirstAssessment, guideSeen]);

  const closeGuide = useCallback(() => {
    setGuideOpen(false);
    setGuideSeen(true);
    // Back to the ? button, where the guide can be opened again.
    document.querySelector<HTMLElement>('[data-guide="help"]')?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the current question last became the one on screen (CD-97), reset
  // whenever it changes, so a save's elapsed time reflects just this visit,
  // not time spent on earlier questions. Declared before the early returns
  // below so the hook always runs, per the rules of hooks; path/index are
  // both already in scope at this point.
  const currentQuestionId = path?.items[Math.min(index, path.items.length - 1)]?.question.id;
  const shownAt = useRef(Date.now());
  useEffect(() => {
    shownAt.current = Date.now();
  }, [currentQuestionId]);

  // Tell the backend a question was shown (CD-125, drop-off analytics), only
  // ones not yet answered, since an answered question was seen before. Fire
  // and forget: a lost request just means one missing view (an answer implies
  // one anyway), so it's never retried or surfaced, and it never blocks the
  // learner. Skipped while aborting or finishing, like saves, so nothing gets
  // recorded against an attempt that is being deleted or closed.
  const currentUnanswered =
    path !== null && path.items[Math.min(index, path.items.length - 1)]?.answer == null;
  useEffect(() => {
    if (!currentQuestionId || !currentUnanswered) return;
    if (discarding.current || finishing.current) return;
    recordQuestionView(currentQuestionId).catch(() => {});
  }, [currentQuestionId, currentUnanswered]);

  const load = useCallback(() => {
    setLoadFailed(false);
    setPath(null);
    getAssessmentPath().then(
      (loaded) => {
        setPath(loaded);
        setAnswers(answersOf(loaded));
        // Resume at the next question (or the last one, if all are answered).
        setIndex(Math.max(0, loaded.items.length - 1));
      },
      () => setLoadFailed(true),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeExit = useCallback(() => {
    setExitOpen(false);
    setExitError(null);
  }, []);

  /** Refetches the path after a 404 (a question was hidden from the role), staying as close to the same spot as possible. */
  async function reloadAfterRemoval() {
    let fresh: AssessmentPath;
    try {
      fresh = await getAssessmentPath();
    } catch {
      return; // keep the current path; the next Next will surface the problem
    }
    setPath(fresh);
    setAnswers((prev) => ({ ...answersOf(fresh), ...prev }));
    setIndex((i) => Math.max(0, Math.min(i, fresh.items.length - 1)));
    setQuestionsRemoved(true);
  }

  function queueSave(questionId: string, answer: PieAnswer, timeSpentMs?: number) {
    pendingSaves.current = pendingSaves.current.then(async () => {
      if (discarding.current || finishing.current) {
        unsaved.current.set(questionId, { answer, timeSpentMs });
        return;
      }
      try {
        await withRetry(() => saveResponse(questionId, answer, timeSpentMs));
        unsaved.current.delete(questionId);
      } catch (err) {
        if (isApiError(err) && err.status === 404) {
          unsaved.current.delete(questionId);
          await reloadAfterRemoval();
        } else {
          unsaved.current.set(questionId, { answer, timeSpentMs });
        }
      }
      setUnsavedCount(unsaved.current.size);
    });
  }

  function retryUnsaved() {
    setNavError(null);
    for (const [questionId, { answer, timeSpentMs }] of unsaved.current) {
      queueSave(questionId, answer, timeSpentMs);
    }
  }

  if (loadFailed) {
    return (
      <div className={styles.page}>
        <p className={styles.error} role="alert">
          Couldn&apos;t load the assessment. Check your connection and try again.
        </p>
        <div>
          <Button onClick={load}>Try again</Button>
        </div>
      </div>
    );
  }
  if (path === null) return <Spinner />;
  if (path.items.length === 0) return <p>No questions are available yet.</p>;

  const item = path.items[Math.min(index, path.items.length - 1)];
  const current = item.question;
  const isFirst = index === 0;
  const isLast = path.done && index === path.items.length - 1;
  const hasAnswered = answers[current.id]?.complete === true;
  const busy = isMoving || isFinishing;
  // Back is hidden only for the full self-assessment; a partial
  // reassessment and a journey assessment both keep it.
  const canGoBack = path.journey !== null || path.partial;
  const answeredCount = path.items.filter((i) => i.answer !== null).length;

  function handleAnswerChange(answer: PieAnswer) {
    setAnswers((prev) => ({ ...prev, [current.id]: answer }));
    // How long this question has been on screen since it last became the
    // current one (CD-97), not scoring, just a best-effort analytics value.
    if (answer.complete) queueSave(current.id, answer, Date.now() - shownAt.current);
  }

  function handleBack() {
    setNavError(null);
    setIndex((i) => Math.max(0, i - 1));
  }

  /** Waits for every save; false (with an error shown) if any answer is still unsaved. */
  async function allSaved(): Promise<boolean> {
    await pendingSaves.current;
    if (unsaved.current.size === 0) return true;
    setNavError("Some answers haven't been saved yet. Retry saving them before continuing.");
    return false;
  }

  async function finish() {
    setIsFinishing(true);
    finishing.current = true;
    try {
      // Anything queued before Finish was pressed has already been awaited
      // (allSaved); from here on, saves are held back as unsaved instead.
      await pendingSaves.current;
      await withRetry(() => completeAssessment());
      // A journey assessment stands on its own: it doesn't complete the
      // self-assessment, so it lands on the Journeys page's History tab.
      if (path?.journey) {
        navigate("/journeys", { replace: true, state: { tab: "history" } });
        return;
      }
      await withRetry(() => completeInitialAssessment());
      markInitialAssessmentComplete();
      if (path?.partial) {
        navigate("/history", { replace: true, state: { tab: "partial" } });
        return;
      }
      navigate("/", { replace: true });
    } catch {
      // Safe to press Finish again: completing an already-completed
      // instance is a no-op on the backend.
      setNavError("Couldn't finish the assessment. Your answers are saved, please try again.");
      finishing.current = false;
      setUnsavedCount(unsaved.current.size);
      setIsFinishing(false);
    }
  }

  /**
   * Saves, asks the backend for the path again (the newest answer decides
   * what comes after it), then moves one step along it, or finishes when
   * the path ends here.
   */
  async function handleNext() {
    setIsMoving(true);
    setNavError(null);
    try {
      if (!(await allSaved())) return;

      let fresh: AssessmentPath;
      try {
        fresh = await withRetry(() => getAssessmentPath());
      } catch {
        setNavError("Couldn't load the next question. Your answers are saved, please try again.");
        return;
      }
      setPath(fresh);
      setAnswers((prev) => ({ ...answersOf(fresh), ...prev }));

      if (index + 1 < fresh.items.length) setIndex(index + 1);
      else if (fresh.done) await finish();
    } finally {
      setIsMoving(false);
    }
  }

  async function handleSaveAndExit() {
    setExitStatus("leaving");
    setExitError(null);
    retryUnsaved();
    await pendingSaves.current;

    if (unsaved.current.size > 0) {
      setExitError("Some answers still couldn't be saved. Check your connection and try again.");
      setExitStatus("idle");
      return;
    }
    navigate("/", { replace: true });
  }

  async function handleDiscard() {
    discarding.current = true;
    setExitStatus("discarding");
    setExitError(null);
    await pendingSaves.current;

    try {
      await withRetry(() => discardAssessment());
      unsaved.current.clear();
      navigate("/", { replace: true });
    } catch {
      discarding.current = false;
      setUnsavedCount(unsaved.current.size);
      setExitError("Couldn't abort the assessment. Check your connection and try again.");
      setExitStatus("idle");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        {/* Left, on the same side as Back, the "leave" side of the page ,
            so the right stays for moving forward (the count, then Next). */}
        <Button
          variant="danger"
          onClick={() => setExitOpen(true)}
          disabled={isFinishing}
          data-guide="exit"
        >
          <CloseIcon width={16} height={16} aria-hidden="true" />
          Exit
        </Button>
        <div className={styles.progress} data-guide="progress">
          {/* A partial reassessment asks every question, so it can count
              them; otherwise how many a section takes depends on the answers. */}
          {path.partial ? (
            <AssessmentProgress
              current={answeredCount}
              total={path.totalQuestions}
              label={`${answeredCount} of ${path.totalQuestions} answered`}
            />
          ) : (
            <AssessmentProgress
              current={item.sectionNumber - 1}
              total={path.sectionCount}
              label={`Section ${item.sectionNumber} of ${path.sectionCount}`}
            />
          )}
        </div>
        <button
          type="button"
          className={styles.help}
          onClick={() => setGuideOpen(true)}
          aria-label="How the assessment works"
          title="How the assessment works"
          data-guide="help"
        >
          <HelpIcon width={20} height={20} aria-hidden="true" />
        </button>
      </div>

      {path.journey && (
        <p className={styles.journeyBanner}>
          Assessing the journey <strong>{path.journey.name ?? "you chose"}</strong>. Your result
          shows on the Learning journeys page&apos;s History tab, your best result also counts under
          Competencies, and it doesn&apos;t change your self-assessment.
        </p>
      )}

      {unsavedCount > 0 && (
        <div className={styles.alert} role="alert">
          <p className={styles.alertText}>
            {unsavedCount === 1 ? "1 answer hasn't" : `${unsavedCount} answers haven't`} been saved.
            Check your connection and retry.
          </p>
          <Button variant="secondary" onClick={retryUnsaved}>
            Retry saving
          </Button>
        </div>
      )}
      {questionsRemoved && (
        <p className={styles.note} role="status">
          Some questions are no longer available for your role and were removed.
        </p>
      )}

      <div data-guide="question">
        <QuestionCard
          key={current.id}
          question={current}
          answer={answers[current.id]}
          onAnswerChange={handleAnswerChange}
        />
      </div>

      {navError && (
        <p className={styles.error} role="alert">
          {navError}
        </p>
      )}

      <div className={styles.nav}>
        {canGoBack && (
          <Button variant="secondary" onClick={handleBack} disabled={isFirst || busy}>
            Back
          </Button>
        )}
        <Button
          className={!canGoBack ? styles.nextAlone : undefined}
          onClick={() => void handleNext()}
          disabled={!hasAnswered || busy}
          data-guide="next"
        >
          {isFinishing ? "Finishing…" : isLast ? "Finish" : "Next"}
        </Button>
      </div>

      {guideOpen && (
        <AssessmentGuide steps={assessmentGuideSteps({ canGoBack })} onClose={closeGuide} />
      )}

      {exitOpen && (
        <ExitAssessmentDialog
          unsavedCount={unsavedCount}
          status={exitStatus}
          error={exitError}
          onKeepGoing={closeExit}
          onSaveAndExit={() => void handleSaveAndExit()}
          onDiscard={() => void handleDiscard()}
        />
      )}
    </div>
  );
}

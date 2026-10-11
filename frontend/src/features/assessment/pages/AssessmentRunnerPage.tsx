import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { completeInitialAssessment } from "@/features/auth";
import { isApiError } from "@/shared/api/client";
import { withRetry } from "@/shared/api/retry";
import { Button } from "@/shared/components/Button";
import { CloseIcon } from "@/shared/components/icons";
import { Spinner } from "@/shared/components/Spinner";
import { AssessmentProgress } from "../components/AssessmentProgress";
import { ExitAssessmentDialog, type ExitStatus } from "../components/ExitAssessmentDialog";
import { QuestionCard } from "../components/QuestionCard";
import type { PieAnswer } from "../components/PieQuestionPlayer";
import { completeAssessment, discardAssessment, getAssessmentPath, saveResponse } from "../api";
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
 * right and on to the next section as soon as that's out of reach. So the page doesn't hold the whole question list — it
 * holds the path so far (answered questions + the next one) and refetches it
 * after every Next. Answered questions are history: Back revisits them and
 * changing an answer only changes its score — which question comes next is
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
 * it mid-assessment) — retrying can't help, so the path is reloaded instead.
 *
 * Exit opens a dialog: "Save & exit" leaves once every answer is saved (the
 * learner resumes later); "Abort" deletes the in-progress instance and all
 * its answers. Abort first stops queued saves and waits for the one in
 * flight — a save landing after the delete would otherwise create a new
 * instance holding just that answer.
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
  // Next/Finish wait for the queue — the next question depends on the
  // answer, and a save still in flight when the instance is completed would
  // create a brand-new instance for that answer.
  const pendingSaves = useRef<Promise<unknown>>(Promise.resolve());
  // Latest answer per question whose save failed. A ref (read right after
  // awaiting the queue), mirrored into state for rendering.
  const unsaved = useRef(new Map<string, PieAnswer>());
  const [unsavedCount, setUnsavedCount] = useState(0);
  // Set while an abort is deleting the instance: queued saves are skipped
  // (kept as unsaved in case the delete fails) instead of recreating it.
  const discarding = useRef(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitStatus, setExitStatus] = useState<ExitStatus>("idle");
  const [exitError, setExitError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { markInitialAssessmentComplete } = useAuth();

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

  function queueSave(questionId: string, answer: PieAnswer) {
    pendingSaves.current = pendingSaves.current.then(async () => {
      if (discarding.current) {
        unsaved.current.set(questionId, answer);
        return;
      }
      try {
        await withRetry(() => saveResponse(questionId, answer));
        unsaved.current.delete(questionId);
      } catch (err) {
        if (isApiError(err) && err.status === 404) {
          unsaved.current.delete(questionId);
          await reloadAfterRemoval();
        } else {
          unsaved.current.set(questionId, answer);
        }
      }
      setUnsavedCount(unsaved.current.size);
    });
  }

  function retryUnsaved() {
    setNavError(null);
    for (const [questionId, answer] of unsaved.current) queueSave(questionId, answer);
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

  function handleAnswerChange(answer: PieAnswer) {
    setAnswers((prev) => ({ ...prev, [current.id]: answer }));
    if (answer.complete) queueSave(current.id, answer);
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
    try {
      await withRetry(() => completeAssessment());
      await withRetry(() => completeInitialAssessment());
      markInitialAssessmentComplete();
      navigate("/", { replace: true });
    } catch {
      // Safe to press Finish again: completing an already-completed
      // instance is a no-op on the backend.
      setNavError("Couldn't finish the assessment. Your answers are saved — please try again.");
      setIsFinishing(false);
    }
  }

  /**
   * Saves, asks the backend for the path again (the newest answer decides
   * what comes after it), then moves one step along it — or finishes when
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
        setNavError("Couldn't load the next question. Your answers are saved — please try again.");
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
        {/* Left, on the same side as Back — the "leave" side of the page —
            so the right stays for moving forward (the count, then Next). */}
        <Button variant="danger" onClick={() => setExitOpen(true)} disabled={isFinishing}>
          <CloseIcon width={16} height={16} aria-hidden="true" />
          Exit
        </Button>
        <div className={styles.progress}>
          {/* Sections are the unit of progress: how many questions a section
              takes depends on the answers. */}
          <AssessmentProgress
            current={item.sectionNumber - 1}
            total={path.sectionCount}
            label={`Section ${item.sectionNumber} of ${path.sectionCount}`}
          />
        </div>
      </div>

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

      <QuestionCard
        key={current.id}
        question={current}
        answer={answers[current.id]}
        onAnswerChange={handleAnswerChange}
      />

      {navError && (
        <p className={styles.error} role="alert">
          {navError}
        </p>
      )}

      <div className={styles.nav}>
        <Button variant="secondary" onClick={handleBack} disabled={isFirst || busy}>
          Back
        </Button>
        <Button onClick={() => void handleNext()} disabled={!hasAnswered || busy}>
          {isFinishing ? "Finishing…" : isLast ? "Finish" : "Next"}
        </Button>
      </div>

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

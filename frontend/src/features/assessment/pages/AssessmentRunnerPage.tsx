import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { completeInitialAssessment } from "@/features/auth";
import { isApiError } from "@/shared/api/client";
import { withRetry } from "@/shared/api/retry";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { AssessmentProgress } from "../components/AssessmentProgress";
import { QuestionCard } from "../components/QuestionCard";
import type { PieAnswer } from "../components/PieQuestionPlayer";
import { completeAssessment, getProgress, getQuestions, saveResponse } from "../api";
import type { Question } from "../types";
import styles from "./AssessmentRunnerPage.module.css";

/**
 * Runs the questionnaire one question at a time with a progress bar on top.
 * Each answer is saved to the backend as it changes (CD-7 / SAT2 save &
 * resume), and on mount any previously saved answers are restored and the
 * learner is dropped back at the first question they haven't finished yet —
 * so leaving mid-assessment and coming back continues where they left off.
 * Back still restores from local state so navigating within the session
 * stays instant. Finishing the last question marks the SAT instance
 * complete (which rolls its answers up into the competence scores the
 * dashboard's radar shows) and flags the learner as having completed the
 * initial assessment — the dashboard is only shown once both have finished,
 * so it never loads scores from before this run.
 *
 * Nothing fails silently: a failed load offers a retry; a save that still
 * fails after retrying is kept as "unsaved" with a banner to retry it, and
 * Finish refuses to complete the instance while any answer is unsaved (the
 * scores would otherwise be computed without it). A save rejected with 404
 * means the question is no longer visible to the learner's role (an admin
 * changed it mid-assessment) — retrying can't help, so the question list is
 * reloaded instead.
 */
export function AssessmentRunnerPage() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, PieAnswer>>({});
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [questionsRemoved, setQuestionsRemoved] = useState(false);
  // Saves run one after another, in the order the learner made them, and
  // Finish waits for the queue — otherwise a save still in flight when the
  // instance is completed would create a brand-new instance for that answer.
  const pendingSaves = useRef<Promise<unknown>>(Promise.resolve());
  // Latest answer per question whose save failed. A ref (read right after
  // awaiting the queue in handleFinish), mirrored into state for rendering.
  const unsaved = useRef(new Map<string, PieAnswer>());
  const [unsavedCount, setUnsavedCount] = useState(0);
  // The current question/index, for async code that outlives a render.
  const latest = useRef({ questions, index });
  const navigate = useNavigate();
  const { markInitialAssessmentComplete } = useAuth();

  useEffect(() => {
    latest.current = { questions, index };
  }, [questions, index]);

  const load = useCallback(() => {
    setLoadFailed(false);
    setQuestions(null);
    Promise.all([getQuestions(), getProgress()]).then(
      ([loadedQuestions, progress]) => {
        setQuestions(loadedQuestions);

        if (!progress) return;

        const restored = Object.fromEntries(
          progress.responses.map((r) => [r.questionId, r.answer]),
        );
        setAnswers(restored);

        const firstUnanswered = loadedQuestions.findIndex((q) => !restored[q.id]?.complete);
        setIndex(firstUnanswered === -1 ? loadedQuestions.length - 1 : firstUnanswered);
      },
      // Progress failing counts too: starting over without the saved
      // answers would silently discard where the learner left off.
      () => setLoadFailed(true),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Refetches the question list after a 404, keeping the learner on the same question if it survived. */
  async function dropUnavailableQuestions() {
    let fresh: Question[];
    try {
      fresh = await getQuestions();
    } catch {
      return; // keep the current list; the next save will surface the problem
    }
    const ids = new Set(fresh.map((q) => q.id));
    for (const id of [...unsaved.current.keys()]) if (!ids.has(id)) unsaved.current.delete(id);

    const { questions: previous, index: previousIndex } = latest.current;
    const currentId = previous?.[previousIndex]?.id;
    const stillThere = fresh.findIndex((q) => q.id === currentId);

    setQuestions(fresh);
    setIndex(
      stillThere !== -1 ? stillThere : Math.max(0, Math.min(previousIndex, fresh.length - 1)),
    );
    setAnswers((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => ids.has(id))));
    setQuestionsRemoved(true);
  }

  function queueSave(questionId: string, answer: PieAnswer) {
    pendingSaves.current = pendingSaves.current.then(async () => {
      try {
        await withRetry(() => saveResponse(questionId, answer));
        unsaved.current.delete(questionId);
      } catch (err) {
        if (isApiError(err) && err.status === 404) {
          unsaved.current.delete(questionId);
          await dropUnavailableQuestions();
        } else {
          unsaved.current.set(questionId, answer);
        }
      }
      setUnsavedCount(unsaved.current.size);
    });
  }

  function retryUnsaved() {
    setFinishError(null);
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
  if (questions === null) return <Spinner />;
  if (questions.length === 0) return <p>No questions are available yet.</p>;

  const current = questions[index];
  const isFirst = index === 0;
  const isLast = index === questions.length - 1;
  const hasAnswered = answers[current.id]?.complete === true;

  function handleAnswerChange(answer: PieAnswer) {
    setAnswers((prev) => ({ ...prev, [current.id]: answer }));
    if (answer.complete) queueSave(current.id, answer);
  }

  function handleBack() {
    setIndex((i) => Math.max(0, i - 1));
  }

  async function handleFinish() {
    setIsFinishing(true);
    setFinishError(null);
    await pendingSaves.current;

    if (unsaved.current.size > 0) {
      setFinishError("Some answers haven't been saved yet. Retry saving them before finishing.");
      setIsFinishing(false);
      return;
    }

    try {
      await withRetry(() => completeAssessment());
      await withRetry(() => completeInitialAssessment());
      markInitialAssessmentComplete();
      navigate("/", { replace: true });
    } catch {
      // Safe to press Finish again: completing an already-completed
      // instance is a no-op on the backend.
      setFinishError("Couldn't finish the assessment. Your answers are saved — please try again.");
      setIsFinishing(false);
    }
  }

  function handleNext() {
    if (isLast) void handleFinish();
    else setIndex((i) => i + 1);
  }

  return (
    <div className={styles.page}>
      <AssessmentProgress current={index + 1} total={questions.length} />

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

      {finishError && (
        <p className={styles.error} role="alert">
          {finishError}
        </p>
      )}

      <div className={styles.nav}>
        <Button variant="secondary" onClick={handleBack} disabled={isFirst}>
          Back
        </Button>
        <Button onClick={handleNext} disabled={!hasAnswered || isFinishing}>
          {isLast ? "Finish" : "Next"}
        </Button>
      </div>
    </div>
  );
}

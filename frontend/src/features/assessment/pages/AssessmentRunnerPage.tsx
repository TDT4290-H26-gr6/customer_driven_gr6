import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { completeInitialAssessment } from "@/features/auth";
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
 */
export function AssessmentRunnerPage() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, PieAnswer>>({});
  const [isFinishing, setIsFinishing] = useState(false);
  // Saves run one after another, in the order the learner made them, and
  // Finish waits for the queue — otherwise a save still in flight when the
  // instance is completed would create a brand-new instance for that answer.
  const pendingSaves = useRef<Promise<unknown>>(Promise.resolve());
  const navigate = useNavigate();
  const { markInitialAssessmentComplete } = useAuth();

  useEffect(() => {
    Promise.all([getQuestions(), getProgress().catch(() => null)]).then(
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
      () => setQuestions([]),
    );
  }, []);

  if (questions === null) return <Spinner />;
  if (questions.length === 0) return <p>No questions are available yet.</p>;

  const current = questions[index];
  const isFirst = index === 0;
  const isLast = index === questions.length - 1;
  const hasAnswered = answers[current.id]?.complete === true;

  function handleAnswerChange(answer: PieAnswer) {
    setAnswers((prev) => ({ ...prev, [current.id]: answer }));
    if (answer.complete) {
      pendingSaves.current = pendingSaves.current
        .then(() => saveResponse(current.id, answer))
        .catch(() => {
          /* best-effort — Back/Next still work from local state this session */
        });
    }
  }

  function handleBack() {
    setIndex((i) => Math.max(0, i - 1));
  }

  function handleNext() {
    if (isLast) {
      setIsFinishing(true);
      pendingSaves.current
        .then(() => completeAssessment())
        .then(() => completeInitialAssessment())
        .then(markInitialAssessmentComplete)
        .catch(() => {
          /* dashboard falls back to the welcome screen until this succeeds */
        })
        .finally(() => navigate("/", { replace: true }));
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <div className={styles.page}>
      <AssessmentProgress current={index + 1} total={questions.length} />
      <QuestionCard
        key={current.id}
        question={current}
        answer={answers[current.id]}
        onAnswerChange={handleAnswerChange}
      />
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

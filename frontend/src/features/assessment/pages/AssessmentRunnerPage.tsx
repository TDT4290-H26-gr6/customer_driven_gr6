import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { completeInitialAssessment } from "@/features/auth";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { AssessmentProgress } from "../components/AssessmentProgress";
import { QuestionCard } from "../components/QuestionCard";
import type { PieAnswer } from "../components/PieQuestionPlayer";
import { completeSatInstance, getQuestions, startSatInstance, submitResponse } from "../api";
import type { Question } from "../types";
import styles from "./AssessmentRunnerPage.module.css";

/**
 * Runs the questionnaire one question at a time with a progress bar on top.
 * Answers are kept in memory locally, keyed by question id, so Back can
 * restore whatever was previously selected and Next/Finish is disabled
 * until the current question is complete (per the widget's own
 * isComplete() — see PieQuestionPlayer). Each answer is persisted to the
 * backend (scored server-side) only once its question is left via Next —
 * by then hasAnswered has already gated on isComplete(), so the answer is
 * final. Persistence failures are swallowed: this in-memory run is still
 * fully usable, it just won't show real results until submission succeeds.
 */
export function AssessmentRunnerPage() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [satInstanceId, setSatInstanceId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, PieAnswer>>({});
  const navigate = useNavigate();
  const { markInitialAssessmentComplete } = useAuth();

  useEffect(() => {
    getQuestions()
      .then(setQuestions)
      .catch(() => setQuestions([]));
    startSatInstance()
      .then((instance) => setSatInstanceId(instance.id))
      .catch(() => {
        /* answers still work locally; they just won't be persisted/scored */
      });
  }, []);

  if (questions === null) return <Spinner />;
  if (questions.length === 0) return <p>No questions are available yet.</p>;

  const current = questions[index];
  const isFirst = index === 0;
  const isLast = index === questions.length - 1;
  const hasAnswered = answers[current.id]?.complete === true;

  function handleAnswerChange(answer: PieAnswer) {
    setAnswers((prev) => ({ ...prev, [current.id]: answer }));
  }

  function handleBack() {
    setIndex((i) => Math.max(0, i - 1));
  }

  async function handleNext() {
    if (satInstanceId) {
      await submitResponse(satInstanceId, current.id, answers[current.id].session).catch(() => {
        /* see the persistence-failure note above */
      });
    }

    if (isLast) {
      const finish = satInstanceId ? completeSatInstance(satInstanceId) : Promise.resolve();
      finish
        .catch(() => {})
        .then(completeInitialAssessment)
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
        <Button onClick={handleNext} disabled={!hasAnswered}>
          {isLast ? "Finish" : "Next"}
        </Button>
      </div>
    </div>
  );
}

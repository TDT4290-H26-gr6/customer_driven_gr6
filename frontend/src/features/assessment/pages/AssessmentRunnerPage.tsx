import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { AssessmentProgress } from "../components/AssessmentProgress";
import { QuestionCard } from "../components/QuestionCard";
import { getQuestions } from "../api";
import type { Question } from "../types";
import styles from "./AssessmentRunnerPage.module.css";

/**
 * Runs the questionnaire one question at a time with a progress bar on top.
 * There is no results/scoring step yet — finishing just returns to the
 * dashboard (see context/frontend-structure.md, assessment rollout step 5).
 */
export function AssessmentRunnerPage() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    getQuestions()
      .then(setQuestions)
      .catch(() => setQuestions([]));
  }, []);

  if (questions === null) return <Spinner />;
  if (questions.length === 0) return <p>No questions are available yet.</p>;

  const current = questions[index];
  const isLast = index === questions.length - 1;

  function handleNext() {
    if (isLast) {
      navigate("/", { replace: true });
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <div className={styles.page}>
      <AssessmentProgress current={index + 1} total={questions.length} />
      <QuestionCard key={current.id} question={current} />
      <div className={styles.nav}>
        <Button onClick={handleNext}>{isLast ? "Finish" : "Next"}</Button>
      </div>
    </div>
  );
}

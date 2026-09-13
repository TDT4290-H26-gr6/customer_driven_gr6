import { PieQuestionPlayer } from "./PieQuestionPlayer";
import type { Question } from "../types";
import styles from "./QuestionCard.module.css";

export function QuestionCard({ question }: { question: Question }) {
  return (
    <div className={styles.card}>
      <span className={styles.badge}>{question.competenceArea.name}</span>
      <p className={styles.prompt}>{question.prompt}</p>
      <PieQuestionPlayer content={question.content} />
    </div>
  );
}

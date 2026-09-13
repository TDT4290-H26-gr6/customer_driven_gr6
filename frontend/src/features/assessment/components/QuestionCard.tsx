import { PieQuestionPlayer, type PieAnswer } from "./PieQuestionPlayer";
import type { Question } from "../types";
import styles from "./QuestionCard.module.css";

type Props = {
  question: Question;
  answer?: PieAnswer;
  onAnswerChange: (answer: PieAnswer) => void;
};

export function QuestionCard({ question, answer, onAnswerChange }: Props) {
  return (
    <div className={styles.card}>
      <span className={styles.badge}>{question.competenceArea.name}</span>
      {/* <p className={styles.prompt}>{question.prompt}</p> */}
      <PieQuestionPlayer content={question.content} answer={answer} onAnswerChange={onAnswerChange} />
    </div>
  );
}

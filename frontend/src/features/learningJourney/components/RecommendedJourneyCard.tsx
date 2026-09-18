import type { LearningJourney } from "../types";
import styles from "./RecommendedJourneyCard.module.css";

type Props = {
  journey: LearningJourney;
};

/** "What to do next" — the one journey recommended from the learner's latest scores. */
export function RecommendedJourneyCard({ journey }: Props) {
  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>Recommended for you</p>
      <h2 className={styles.name}>{journey.name}</h2>
      {journey.description && <p className={styles.description}>{journey.description}</p>}

      {journey.modules.length > 0 && (
        <ol className={styles.modules}>
          {journey.modules.map((module) => (
            <li key={module.id} className={styles.module}>
              <span className={styles.moduleTitle}>{module.title}</span>
              {module.description && (
                <span className={styles.moduleDescription}>{module.description}</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

import type { JourneySource } from "../api";
import type { LearningJourney } from "../types";
import styles from "./RecommendedJourneyCard.module.css";

type Props = {
  journey: LearningJourney;
  /**
   * "recommended" (default): picked for a weak area. "suggested": nothing is
   * weak, so it's one to keep improving with.
   */
  source?: JourneySource;
  /** Why it fits this learner, when the AI advisor chose it. */
  reason?: string | null;
};

const EYEBROW: Record<JourneySource, string> = {
  recommended: "Recommended for you",
  suggested: "To keep improving",
};

/** "What to do next" — the journey recommended (or suggested) from the learner's latest scores. */
export function RecommendedJourneyCard({ journey, source = "recommended", reason }: Props) {
  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>{EYEBROW[source]}</p>
      <h2 className={styles.name}>{journey.name}</h2>
      {journey.description && <p className={styles.description}>{journey.description}</p>}
      {reason && (
        <p className={styles.reason}>
          <span className={styles.reasonLabel}>Why this journey: </span>
          {reason}
        </p>
      )}

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

      {journey.moodleUrl && (
        <a
          className={styles.moodleLink}
          href={journey.moodleUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in Moodle ↗
        </a>
      )}
    </div>
  );
}

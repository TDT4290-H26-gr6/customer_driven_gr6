import type { JourneySource } from "../api";
import type { LearningJourney } from "../types";
import styles from "./RecommendedJourneys.module.css";

/** A recommended journey and why it fits; reason is null when it's ranked on score alone. */
export type RankedJourney = {
  journey: Pick<LearningJourney, "id" | "name" | "description" | "moodleUrl" | "modules">;
  reason: string | null;
};

type Props = {
  /** Best fit first; the first is highlighted, the second shown smaller. */
  ranked: RankedJourney[];
  /** "recommended": for weak areas. "suggested": nothing is weak — journeys to keep improving with. */
  source: JourneySource;
};

const HEADING: Record<JourneySource, string> = {
  recommended: "Recommended for you",
  suggested: "To keep improving",
};

function MoodleLink({ url, prominent }: { url: string; prominent: boolean }) {
  return (
    <a
      className={prominent ? styles.moodleButton : styles.moodleLink}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      Open in Moodle ↗
    </a>
  );
}

/**
 * "What to do next": the two learning journeys that fit the learner best,
 * ranked on their scores and their profile (the AI advisor's ranking, or by
 * score alone until it's available). The best fit is the large, highlighted
 * card; the runner-up sits under it, smaller.
 */
export function RecommendedJourneys({ ranked, source }: Props) {
  if (ranked.length === 0) return null;
  const [best, runnerUp] = ranked;

  return (
    <section className={styles.wrap} aria-labelledby="recommended-journeys-heading">
      <h2 id="recommended-journeys-heading" className={styles.heading}>
        {HEADING[source]}
      </h2>

      <ol className={styles.list} aria-label="Learning journeys, best fit first">
        <li className={styles.best}>
          <span className={styles.bestBadge}>★ Best fit for you</span>
          <h3 className={styles.bestName}>{best.journey.name}</h3>
          {best.journey.description && (
            <p className={styles.description}>{best.journey.description}</p>
          )}
          {best.reason && (
            <p className={styles.reason}>
              <span className={styles.reasonLabel}>Why it fits you best: </span>
              {best.reason}
            </p>
          )}
          {best.journey.modules.length > 0 && (
            <ol className={styles.steps}>
              {best.journey.modules.map((module) => (
                <li key={module.id}>
                  <span className={styles.stepTitle}>{module.title}</span>
                  {module.description && (
                    <span className={styles.stepDescription}>{module.description}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
          {best.journey.moodleUrl && <MoodleLink url={best.journey.moodleUrl} prominent />}
        </li>

        {runnerUp && (
          <li className={styles.runnerUp}>
            <span className={styles.runnerUpLabel}>Also a good fit</span>
            <h3 className={styles.runnerUpName}>{runnerUp.journey.name}</h3>
            {runnerUp.reason && <p className={styles.runnerUpReason}>{runnerUp.reason}</p>}
            {runnerUp.journey.moodleUrl && (
              <MoodleLink url={runnerUp.journey.moodleUrl} prominent={false} />
            )}
          </li>
        )}
      </ol>
    </section>
  );
}

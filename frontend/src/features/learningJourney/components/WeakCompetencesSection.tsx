import type { WeakCompetence } from "../types";
import styles from "./WeakCompetencesSection.module.css";

type Props = {
  competences: WeakCompetence[];
};

function percent(score: number, maxScore: number): number {
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

/**
 * Every competence at or below the 60% threshold (CD-90) — the full picture
 * of where a learner is lacking, not just the single journey "Recommended
 * for you" picks. Shows a positive message instead of an empty list when
 * nothing qualifies.
 */
export function WeakCompetencesSection({ competences }: Props) {
  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>Where you&apos;re lacking</p>

      {competences.length === 0 ? (
        <p className={styles.sufficient}>You&apos;re sufficient in every area — nice work.</p>
      ) : (
        <ul className={styles.list}>
          {competences.map((c) => (
            <li key={c.competenceId} className={styles.row}>
              <div className={styles.rowHeader}>
                <span className={styles.competenceName}>{c.competenceName}</span>
                <span className={styles.score}>{percent(c.score, c.maxScore)}%</span>
              </div>
              {c.journey && (
                <span className={styles.journeyName}>Covered by: {c.journey.name}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

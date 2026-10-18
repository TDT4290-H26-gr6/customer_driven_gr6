import styles from "./SectionLevel.module.css";

type Props =
  | { level: number; levelCount: number }
  /** A section this SAT didn't touch. */
  | { notAssessed: true };

/**
 * The learner's level in one section, shown under its heading in the
 * detailed view, before the per-competence scores: how far up the
 * section's levels they've climbed, one step per level.
 *
 * What it measures: each section's content is split into levels, easiest
 * first. A level counts as passed once the learner has scored at least
 * two-thirds of its questions' points, which unlocks the next one. A level
 * passed above one that wasn't doesn't count, so this is the longest
 * unbroken run of passed levels from the bottom, not an average score.
 */
export function SectionLevel(props: Props) {
  if ("notAssessed" in props) {
    return (
      <div className={styles.box}>
        <span className={styles.badgeNone}>-</span>
        <div className={styles.info}>
          <span className={styles.title}>Your skill level</span>
          <span className={styles.levelText}>Not assessed yet</span>
        </div>
      </div>
    );
  }

  const { level, levelCount } = props;

  return (
    <div className={styles.box}>
      <span className={level > 0 ? styles.badge : styles.badgeNone}>{level > 0 ? level : "-"}</span>
      <div className={styles.info}>
        <span className={styles.title}>Your skill level</span>
        <span className={styles.levelText}>
          {level > 0 ? `Level ${level} of ${levelCount} passed` : "Level 1 not yet passed"}
        </span>
        <span className={styles.explainer}>
          Levels build on each other, easiest first. Each one needs about two-thirds correct to pass
          and unlock the next.
        </span>
      </div>
      <div className={styles.steps} role="img" aria-label={`Level ${level} of ${levelCount}`}>
        {Array.from({ length: levelCount }, (_, i) => (
          <span key={i} className={i < level ? styles.stepOn : styles.step} />
        ))}
      </div>
    </div>
  );
}

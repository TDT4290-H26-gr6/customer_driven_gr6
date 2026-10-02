import type { SkillLevel } from "../types";
import styles from "./SectionLevel.module.css";

type Props =
  | { skill: SkillLevel }
  /** A section the learner hasn't answered anything in yet. */
  | { notAssessed: { code: string | null } };

/**
 * The learner's level in one section (A1 … A4, level 1 the easiest), shown
 * under that section's radar in the detailed view: a badge plus one step
 * per level. Until level 1 is passed it says so instead of showing a level,
 * and a section not assessed yet says that.
 */
export function SectionLevel(props: Props) {
  if ("notAssessed" in props) {
    return (
      <div className={styles.box}>
        <span className={styles.badgeNone}>{props.notAssessed.code || "–"}</span>
        <div className={styles.info}>
          <span className={styles.title}>Your skill level</span>
          <span className={styles.levelText}>Not assessed yet</span>
        </div>
      </div>
    );
  }

  const { section, level, levelCount } = props.skill;
  const code = section.code ?? "";

  return (
    <div className={styles.box}>
      <span className={level > 0 ? styles.badge : styles.badgeNone}>
        {level > 0 ? `${code}${level}` : code || "–"}
      </span>
      <div className={styles.info}>
        <span className={styles.title}>Your skill level</span>
        <span className={styles.levelText}>
          {level > 0 ? `Level ${level} of ${levelCount}` : `Not yet at ${code}1`}
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

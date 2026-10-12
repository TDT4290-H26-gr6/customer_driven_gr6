import styles from "./AssessmentProgress.module.css";

type Props = {
  /** How far along: the bar fills to current / total. */
  current: number;
  total: number;
  /** Text beside the bar. Defaults to "current / total". */
  label?: string;
};

export function AssessmentProgress({ current, total, label }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={styles.wrap}>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.label}>{label ?? `${current} / ${total}`}</span>
    </div>
  );
}

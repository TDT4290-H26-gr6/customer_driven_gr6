import styles from "./AssessmentProgress.module.css";

type Props = {
  /** 1-based index of the question currently on screen. */
  current: number;
  total: number;
};

export function AssessmentProgress({ current, total }: Props) {
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
      <span className={styles.label}>
        {current} / {total}
      </span>
    </div>
  );
}

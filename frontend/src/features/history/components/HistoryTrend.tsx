import styles from "./HistoryTrend.module.css";

export type TrendPoint = {
  instanceNum: number;
  /** Share of all points earned in that assessment, 0-100. */
  percent: number;
};

/**
 * One bar per completed assessment, oldest on the left: whether the overall
 * score is going up is visible at a glance, before reading any card. Only
 * shown from the second assessment on (a single bar says nothing). Many
 * assessments scroll sideways inside the card rather than squeezing.
 */
export function HistoryTrend({ points }: { points: TrendPoint[] }) {
  return (
    <section className={styles.card} aria-labelledby="trend-heading">
      <h2 id="trend-heading" className={styles.heading}>
        Overall score
      </h2>
      <ol className={styles.bars}>
        {points.map((point) => (
          <li
            key={point.instanceNum}
            className={styles.bar}
            aria-label={`Assessment ${point.instanceNum}: ${point.percent}%`}
          >
            <span className={styles.value} aria-hidden="true">
              {point.percent}%
            </span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.fill} style={{ height: `${point.percent}%` }} />
            </span>
            <span className={styles.label} aria-hidden="true">
              #{point.instanceNum}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

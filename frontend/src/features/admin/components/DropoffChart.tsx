import type { DropoffQuestion } from "../types";
import { shortTitle } from "../dropoff";
import styles from "./DropoffChart.module.css";

const BAR_WIDTH = 18;
const BAR_GAP = 6;
const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 40 };

/**
 * Drop-off rate per question, in the order questions are typically met.
 * Hand-drawn SVG (no chart library in the project). The exact numbers are in
 * the table below, so the chart itself is a visual aid for screen readers.
 */
export function DropoffChart({ questions }: { questions: DropoffQuestion[] }) {
  const ordered = [...questions].sort((a, b) => a.order - b.order);
  const maxRate = Math.max(0.1, ...ordered.map((q) => q.dropOffRate));
  const top = Math.min(1, Math.ceil(maxRate * 10) / 10);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const width = PAD.left + PAD.right + ordered.length * (BAR_WIDTH + BAR_GAP);
  const ticks = [0, top / 2, top];

  return (
    <div className={styles.scroll}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        role="img"
        aria-label="Bar chart of drop-off rate by question order. The table below has the same figures."
      >
        {ticks.map((tick) => {
          const y = PAD.top + plotHeight * (1 - tick / top);
          return (
            <g key={tick}>
              <line className={styles.grid} x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} />
              <text className={styles.axisLabel} x={PAD.left - 6} y={y + 4} textAnchor="end">
                {Math.round(tick * 100)}%
              </text>
            </g>
          );
        })}
        {ordered.map((q, index) => {
          const x = PAD.left + index * (BAR_WIDTH + BAR_GAP) + BAR_GAP / 2;
          const barHeight = plotHeight * (q.dropOffRate / top);
          return (
            <g key={q.questionId}>
              <rect
                className={q.lowSample ? styles.barLow : styles.bar}
                x={x}
                y={PAD.top + plotHeight - barHeight}
                width={BAR_WIDTH}
                height={Math.max(barHeight, q.dropOffRate > 0 ? 1 : 0)}
              >
                <title>
                  {`#${q.order} ${shortTitle(q.text)}: ${Math.round(q.dropOffRate * 100)}% stopped here (${q.droppedCount} of ${q.viewedCount} viewed)${q.lowSample ? " – low sample" : ""}`}
                </title>
              </rect>
              <text
                className={styles.axisLabel}
                x={x + BAR_WIDTH / 2}
                y={HEIGHT - PAD.bottom + 14}
                textAnchor="middle"
              >
                {q.order}
              </text>
            </g>
          );
        })}
        <text
          className={styles.axisLabel}
          x={PAD.left + (width - PAD.left - PAD.right) / 2}
          y={HEIGHT - 2}
          textAnchor="middle"
        >
          Question order
        </text>
      </svg>
    </div>
  );
}

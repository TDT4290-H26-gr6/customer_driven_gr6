import type { CompetenceScore } from "../types";
import styles from "./CompetenceRadar.module.css";

type Props = {
  data: CompetenceScore[];
  size?: number;
};

const RINGS = 4;
// How far outside the triangle each label sits, as a fraction of the radius.
// Side labels (anchor start/end) stay close in — their text runs sideways,
// away from the triangle, so it doesn't need much clearance. A top/bottom
// label (anchor middle) sits directly above/below its vertex instead, and
// wraps onto two lines, so it needs to be pushed out further or its second
// line collides with the triangle.
const LABEL_DISTANCE_SIDE = 1.08;
const LABEL_DISTANCE_MIDDLE = 1.3;
// Split a label onto two lines once it's long enough that a single line
// would run past the chart's own edge (long competence area names do).
const LABEL_WRAP_LENGTH = 18;

/** Breaks a label into at most 2 lines, splitting at the space nearest the middle. */
function wrapLabel(text: string): string[] {
  if (text.length <= LABEL_WRAP_LENGTH) return [text];

  const middle = text.length / 2;
  let splitAt = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== " ") continue;
    const distance = Math.abs(i - middle);
    if (distance < bestDistance) {
      bestDistance = distance;
      splitAt = i;
    }
  }

  return splitAt === -1 ? [text] : [text.slice(0, splitAt), text.slice(splitAt + 1)];
}

/** Radar / spider chart of skill levels, one axis per competence area. */
export function CompetenceRadar({ data, size = 380 }: Props) {
  const center = size / 2;
  const radius = size / 2 - 92; // leave room for (possibly two-line) axis labels
  const count = data.length;

  if (count < 3) {
    return <p className={styles.empty}>Not enough skill areas yet to draw a chart.</p>;
  }

  const angleFor = (i: number) => (Math.PI * 2 * i) / count - Math.PI / 2;

  const pointAt = (i: number, fraction: number) => {
    const angle = angleFor(i);
    return {
      x: center + radius * fraction * Math.cos(angle),
      y: center + radius * fraction * Math.sin(angle),
    };
  };

  const toPolygon = (points: { x: number; y: number }[]) =>
    points.map((p) => `${p.x},${p.y}`).join(" ");

  const ringPolygons = Array.from({ length: RINGS }, (_, ring) => {
    const fraction = (ring + 1) / RINGS;
    return toPolygon(data.map((_, i) => pointAt(i, fraction)));
  });

  const dataPoints = data.map((d, i) => pointAt(i, Math.max(0, Math.min(1, d.score / d.maxScore))));

  const totalScore = data.reduce((sum, d) => sum + d.score, 0);
  const totalMaxScore = data.reduce((sum, d) => sum + d.maxScore, 0);
  const areaSummary = data
    .map((d) => `${d.competenceArea.name} ${d.score} out of ${d.maxScore}`)
    .join(", ");

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Skill levels radar chart, total score ${totalScore} out of ${totalMaxScore}. ${areaSummary}.`}
      // Numbers are deliberately not drawn — only competence area names label
      // the chart. They stay in the aria-label above so the same information
      // is still available to screen reader users.
    >
      {ringPolygons.map((points, i) => (
        <polygon key={i} points={points} className={styles.ring} />
      ))}

      {data.map((_, i) => {
        const outer = pointAt(i, 1);
        return (
          <line key={i} x1={center} y1={center} x2={outer.x} y2={outer.y} className={styles.axis} />
        );
      })}

      <polygon points={toPolygon(dataPoints)} className={styles.area} />

      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} className={styles.point} />
      ))}

      {data.map((d, i) => {
        const angle = angleFor(i);
        const cos = Math.cos(angle);
        const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
        const label = pointAt(i, anchor === "middle" ? LABEL_DISTANCE_MIDDLE : LABEL_DISTANCE_SIDE);
        const lines = wrapLabel(d.competenceArea.name);
        return (
          <text
            key={i}
            x={label.x}
            y={label.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className={styles.label}
          >
            {lines.map((line, li) => (
              <tspan key={li} x={label.x} dy={li === 0 ? `${-(lines.length - 1) * 0.6}em` : "1.2em"}>
                {line}
              </tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}

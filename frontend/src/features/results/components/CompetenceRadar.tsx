import type { CompetenceScore } from "../types";
import styles from "./CompetenceRadar.module.css";

type Props = {
  data: CompetenceScore[];
  size?: number;
};

const RINGS = 4;

/** Radar / spider chart of skill levels, one axis per competence area. */
export function CompetenceRadar({ data, size = 340 }: Props) {
  const center = size / 2;
  const radius = size / 2 - 56; // leave room for axis labels
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

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Skill levels radar chart"
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
        const label = pointAt(i, 1.18);
        const angle = angleFor(i);
        const cos = Math.cos(angle);
        const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
        return (
          <text
            key={i}
            x={label.x}
            y={label.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className={styles.label}
          >
            {d.competenceArea.name}
          </text>
        );
      })}
    </svg>
  );
}

import { useLayoutEffect, useRef, useState } from "react";
import type { CompetenceScore } from "../types";
import styles from "./CompetenceRadar.module.css";

type Props = {
  data: CompetenceScore[];
  size?: number;
  /**
   * Narrow screens: there's no room beside the chart for long competence
   * names, so axes get numbered tips and the names move into a legend list
   * underneath instead.
   */
  compact?: boolean;
};

const RINGS = 4;

type Bounds = { left: number; right: number; top: number; bottom: number };

// Axis-label text, in SVG units. SVG can't wrap text itself, so names are
// wrapped by character count. The viewBox is sized from the labels' real
// rendered bounds once they're measured (see the layout effect below); the
// generous CHAR_WIDTH estimate only covers the very first render.
const LABEL_FONT_SIZE = 11;
const LABEL_CHAR_WIDTH = LABEL_FONT_SIZE * 0.6;
const LABEL_LINE_HEIGHT = 1.2; // em
/** Names longer than this are split over two lines. */
const MAX_SINGLE_LINE_CHARS = 18;
const VIEWBOX_PADDING = 6;

/** Keeps short names on one line; splits longer ones over two, as evenly as the word breaks allow. */
export function wrapLabel(name: string): string[] {
  if (name.length <= MAX_SINGLE_LINE_CHARS) return [name];

  const words = name.split(" ");
  let best = [name];
  let bestLongest = Infinity;
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const longest = Math.max(lines[0].length, lines[1].length);
    if (longest < bestLongest) {
      best = lines;
      bestLongest = longest;
    }
  }
  return best;
}

/** Radar / spider chart of skill levels, one axis per competence area. */
export function CompetenceRadar({ data, size = 340, compact = false }: Props) {
  const labelsRef = useRef<SVGGElement>(null);
  const [measured, setMeasured] = useState<Bounds | null>(null);

  // Measure the labels as actually rendered, so the chart can be centred on
  // their true extent rather than a guess. Re-measured once web fonts load,
  // since that can change text widths.
  useLayoutEffect(() => {
    const group = labelsRef.current;
    if (!group || typeof group.getBBox !== "function") return;

    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const box = group.getBBox();
      const next = {
        left: box.x,
        right: box.x + box.width,
        top: box.y,
        bottom: box.y + box.height,
      };
      setMeasured((prev) =>
        prev &&
        Object.keys(next).every(
          (k) => Math.abs(next[k as keyof Bounds] - prev[k as keyof Bounds]) < 0.5,
        )
          ? prev
          : next,
      );
    };

    measure();
    document.fonts?.ready.then(measure);
    return () => {
      cancelled = true;
    };
  }, [data, size, compact]);

  const center = size / 2;
  // Leave room for axis labels — a lot for full names, a little for the
  // single-digit tips used in compact mode.
  const radius = size / 2 - (compact ? 28 : 56);
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

  // An area with nothing scored yet has maxScore 0 — plot it at the centre.
  const fractionOf = (d: CompetenceScore) =>
    d.maxScore > 0 ? Math.max(0, Math.min(1, d.score / d.maxScore)) : 0;

  const dataPoints = data.map((d, i) => pointAt(i, fractionOf(d)));

  // Full-name labels (not compact): wrapped, positioned just outside each axis
  // tip, with an estimated box so the viewBox can be grown to contain them.
  const labels = compact
    ? []
    : data.map((d, i) => {
        const pos = pointAt(i, 1.18);
        const cos = Math.cos(angleFor(i));
        const anchor: "start" | "middle" | "end" =
          cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
        const lines = wrapLabel(d.competenceArea.name);
        const width = Math.max(...lines.map((line) => line.length)) * LABEL_CHAR_WIDTH;
        const height = lines.length * LABEL_FONT_SIZE * LABEL_LINE_HEIGHT;
        const left =
          anchor === "start" ? pos.x : anchor === "end" ? pos.x - width : pos.x - width / 2;
        return {
          pos,
          anchor,
          lines,
          box: { left, right: left + width, top: pos.y - height / 2, bottom: pos.y + height / 2 },
        };
      });

  let viewBox = `0 0 ${size} ${size}`;
  if (!compact) {
    const tips = data.map((_, i) => pointAt(i, 1));
    const labelBounds: Bounds = measured ?? {
      left: Math.min(...labels.map((l) => l.box.left)),
      right: Math.max(...labels.map((l) => l.box.right)),
      top: Math.min(...labels.map((l) => l.box.top)),
      bottom: Math.max(...labels.map((l) => l.box.bottom)),
    };
    const minX = Math.min(...tips.map((p) => p.x), labelBounds.left);
    const maxX = Math.max(...tips.map((p) => p.x), labelBounds.right);
    const minY = Math.min(...tips.map((p) => p.y), labelBounds.top);
    const maxY = Math.max(...tips.map((p) => p.y), labelBounds.bottom);

    // Horizontally, extend equally either side of the chart's own centre so the
    // chart itself sits in the middle of the card however unevenly long the
    // names on each side are. Vertically the chart isn't symmetric (labels
    // hang lower on one side), so just centre the tight bounding box.
    const halfWidth = Math.max(center - minX, maxX - center) + VIEWBOX_PADDING;
    viewBox = [
      center - halfWidth,
      minY - VIEWBOX_PADDING,
      halfWidth * 2,
      maxY - minY + VIEWBOX_PADDING * 2,
    ].join(" ");
  }

  return (
    <>
      <svg
        className={compact ? styles.chart : `${styles.chart} ${styles.chartWithLabels}`}
        viewBox={viewBox}
        role="img"
        aria-label="Skill levels radar chart"
      >
        {ringPolygons.map((points, i) => (
          <polygon key={i} points={points} className={styles.ring} />
        ))}

        {data.map((_, i) => {
          const outer = pointAt(i, 1);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              className={styles.axis}
            />
          );
        })}

        <polygon points={toPolygon(dataPoints)} className={styles.area} />

        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} className={styles.point} />
        ))}

        {compact &&
          data.map((_, i) => {
            const tip = pointAt(i, 1.14);
            return (
              <text
                key={i}
                x={tip.x}
                y={tip.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className={styles.tipNumber}
                aria-hidden="true"
              >
                {i + 1}
              </text>
            );
          })}

        {!compact && (
          <g ref={labelsRef}>
            {labels.map(({ pos, anchor, lines }, i) => (
              <text
                key={i}
                x={pos.x}
                y={pos.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={LABEL_FONT_SIZE}
                className={styles.label}
              >
                {lines.map((line, lineIndex) => (
                  <tspan
                    key={lineIndex}
                    x={pos.x}
                    // Centre the whole block on the label position, not just its first line.
                    dy={`${lineIndex === 0 ? (-(lines.length - 1) * LABEL_LINE_HEIGHT) / 2 : LABEL_LINE_HEIGHT}em`}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            ))}
          </g>
        )}
      </svg>

      {compact && (
        <ol className={styles.legend}>
          {data.map((d, i) => (
            <li key={i} className={styles.legendItem}>
              <span className={styles.legendIndex} aria-hidden="true">
                {i + 1}
              </span>
              <span className={styles.legendName}>{d.competenceArea.name}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

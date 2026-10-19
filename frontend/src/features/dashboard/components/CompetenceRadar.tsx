import { useId, useLayoutEffect, useRef, useState } from "react";
import type { CompetenceScore } from "../types";
import styles from "./CompetenceRadar.module.css";

type Props = {
  data: CompetenceScore[];
  /**
   * Another SAT's scores on the same axes (same length and order as `data`),
   * drawn as a dashed outline behind the main shape so the two can be
   * compared. Ignored if it doesn't line up with `data`.
   */
  compare?: CompetenceScore[];
  size?: number;
  /**
   * No full names beside the chart (narrow screens, or names too long for
   * axis labels): axes get short tips and the names move into a legend list
   * underneath instead. Always the same frame, so compact charts shown
   * together all draw at one scale.
   */
  compact?: boolean;
  /**
   * Compact mode: each axis tip's short label, e.g. "A1" for a section's
   * level 1 module. Defaults to the axis number (1, 2, …).
   */
  tipLabels?: (string | null)[];
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
/** No label line is longer than this — longer names wrap onto more lines. */
const MAX_LINE_CHARS = 14;
const VIEWBOX_PADDING = 6;

/** Fills each line with as many words as fit `width`, in order. */
function wrapWords(words: string[], width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A word too long for a line: split after its own hyphens first, then into hyphenated chunks. */
function splitLongWord(word: string): string[] {
  if (word.length <= MAX_LINE_CHARS) return [word];
  return word.split(/(?<=-)/).flatMap((part) => {
    if (part.length <= MAX_LINE_CHARS) return [part];
    const chunks: string[] = [];
    for (let i = 0; i < part.length; i += MAX_LINE_CHARS - 1) {
      const chunk = part.slice(i, i + MAX_LINE_CHARS - 1);
      chunks.push(i + MAX_LINE_CHARS - 1 < part.length ? `${chunk}-` : chunk);
    }
    return chunks;
  });
}

/**
 * The one rule for every axis label: break the name at MAX_LINE_CHARS, word
 * by word — the same fixed width for every name, no per-name balancing — so
 * names are split consistently across all charts. Names that fit stay on one
 * line; a word longer than a line splits at its own hyphens first.
 */
export function wrapLabel(name: string): string[] {
  return wrapWords(name.split(" ").flatMap(splitLongWord), MAX_LINE_CHARS);
}

type Point = { x: number; y: number };

/**
 * A closed shape's edges, each drawn once: edges of no length are dropped,
 * and so is an edge retracing one already listed (A→B after B→A). A shape
 * with most scores at 0 collapses to lines from the centre and back; drawn
 * as one polygon, the dashes going out and coming back fill each other's
 * gaps and the outline looks solid. Drawn edge by edge it stays dashed.
 */
export function outlineEdges(points: Point[]): [Point, Point][] {
  const key = (p: Point) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  const seen = new Set<string>();
  const edges: [Point, Point][] = [];
  points.forEach((from, i) => {
    const to = points[(i + 1) % points.length];
    const [a, b] = [key(from), key(to)];
    if (a === b) return;
    const edge = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(edge)) return;
    seen.add(edge);
    edges.push([from, to]);
  });
  return edges;
}

/**
 * Radar / spider chart of skill levels, one axis per competence. An entry with
 * an empty name is a padding axis (kept so the shape has at least three
 * corners): it is drawn but carries no label. With `compare`, a second SAT is
 * drawn behind it as a dashed, unfilled outline.
 */
export function CompetenceRadar({ data, compare, size = 340, compact = false, tipLabels }: Props) {
  const labelsRef = useRef<SVGGElement>(null);
  const [measured, setMeasured] = useState<Bounds | null>(null);
  // Unique per instance so two charts on one page don't share (and so
  // fight over) the same gradient id.
  const gradientId = `compare-gradient-${useId()}`;

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
  // short tips used in compact mode.
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
  // No dot for a 0 score — it would just sit in the centre.
  const dotted = (scores: CompetenceScore[], points: Point[]) =>
    points.filter((_, i) => fractionOf(scores[i]) > 0);
  const comparePoints =
    compare && compare.length === count ? compare.map((d, i) => pointAt(i, fractionOf(d))) : null;
  const compareEdges = comparePoints ? outlineEdges(comparePoints) : [];
  const compareDots = compare && comparePoints ? dotted(compare, comparePoints) : [];

  /** Each axis tip's short label in compact mode. */
  const tipLabel = (i: number) => tipLabels?.[i] ?? String(i + 1);

  // Full-name labels (not compact): wrapped, positioned just outside each axis
  // tip, with an estimated box so the viewBox can be grown to contain them.
  // A label above the chart grows upwards and one below grows downwards, so
  // a long, many-line name never runs back into the chart; side labels are
  // centred on their tip.
  const lineHeight = LABEL_FONT_SIZE * LABEL_LINE_HEIGHT;
  const labels = compact
    ? []
    : data.map((d, i) => {
        const pos = pointAt(i, 1.18);
        const cos = Math.cos(angleFor(i));
        const sin = Math.sin(angleFor(i));
        const anchor: "start" | "middle" | "end" =
          cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
        const placement: "above" | "below" | "centred" =
          sin < -0.3 ? "above" : sin > 0.3 ? "below" : "centred";
        const lines = wrapLabel(d.competence.name);
        const span = (lines.length - 1) * lineHeight; // first line's centre to last's
        // Where the first line's centre sits relative to the tip, in ems.
        const firstLineEm =
          placement === "above"
            ? -(lines.length - 1) * LABEL_LINE_HEIGHT
            : placement === "below"
              ? 0
              : (-(lines.length - 1) * LABEL_LINE_HEIGHT) / 2;
        const top = pos.y + firstLineEm * LABEL_FONT_SIZE - lineHeight / 2;
        const width = Math.max(...lines.map((line) => line.length)) * LABEL_CHAR_WIDTH;
        const left =
          anchor === "start" ? pos.x : anchor === "end" ? pos.x - width : pos.x - width / 2;
        return {
          pos,
          anchor,
          lines,
          firstLineEm,
          box: { left, right: left + width, top, bottom: top + span + lineHeight },
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
        <defs>
          {/* The "compare" shape's stroke: a lighter tint of the main shape's
              own color, fading further still toward the centre, so it reads
              as the same thing, earlier, not an unrelated line. */}
          <radialGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            cx={center}
            cy={center}
            r={radius}
          >
            <stop offset="0%" className={styles.compareGradientInner} />
            <stop offset="100%" className={styles.compareGradientOuter} />
          </radialGradient>
        </defs>

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

        {comparePoints && (
          <g data-testid="compare-area">
            {/* Drawn before the main shape, so it sits behind it and never
                covers the latest result; where the two SATs score the same,
                the main line simply hides it. Edge by edge (see
                outlineEdges), so the outline stays dashed. */}
            {compareEdges.map(([from, to], i) => (
              <line
                key={`edge-${i}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={styles.compareArea}
                stroke={`url(#${gradientId})`}
              />
            ))}
          </g>
        )}

        {compareDots.map((p, i) => (
          <circle key={`compare-${i}`} cx={p.x} cy={p.y} r={3.5} className={styles.comparePoint} />
        ))}

        <polygon points={toPolygon(dataPoints)} className={styles.area} />

        {dotted(data, dataPoints).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} className={styles.point} />
        ))}

        {compact &&
          data.map((d, i) => {
            if (!d.competence.name) return null;
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
                {tipLabel(i)}
              </text>
            );
          })}

        {!compact && (
          <g ref={labelsRef}>
            {labels.map(({ pos, anchor, lines, firstLineEm }, i) =>
              !data[i].competence.name ? null : (
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
                      // Place the whole block (above, below or centred on the
                      // tip — see `labels`), not just its first line.
                      dy={`${lineIndex === 0 ? firstLineEm : LABEL_LINE_HEIGHT}em`}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              ),
            )}
          </g>
        )}
      </svg>

      {compact && (
        <ol className={styles.legend}>
          {data.map((d, i) =>
            !d.competence.name ? null : (
              <li key={i} className={styles.legendItem}>
                <span className={styles.legendIndex} aria-hidden="true">
                  {tipLabel(i)}
                </span>
                <span className={styles.legendName}>{d.competence.name}</span>
              </li>
            ),
          )}
        </ol>
      )}
    </>
  );
}

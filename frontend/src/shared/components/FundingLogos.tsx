import ikyLogo from "@/shared/assets/iky.jpg";
import styles from "./FundingLogos.module.css";

type Props = {
  className?: string;
};

const PROJECT = "Erasmus+ KA220-HED";
const PROJECT_ID = "2025-1-EL01-KA220-HED-000359135";

// The EU flag per the emblem's official geometry: a 3:2 rectangle, twelve
// stars on a circle whose radius is a third of the flag's height, each star
// a ninth of the height across. Laid out in the viewBox of the logo the
// customer sent (1350×456), so the drawing matches it.
const FLAG = { x: 6, y: 12, width: 408, height: 272 };
const STAR_RING = FLAG.height / 3;
const STAR_RADIUS = FLAG.height / 18;
const STARS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i * Math.PI) / 6;
  return starPath(
    FLAG.x + FLAG.width / 2 + STAR_RING * Math.sin(angle),
    FLAG.y + FLAG.height / 2 - STAR_RING * Math.cos(angle),
  );
}).join("");

/** A five-pointed star, point up, as an SVG path. */
function starPath(cx: number, cy: number): string {
  const inner = STAR_RADIUS * 0.382; // a regular pentagram's inner/outer ratio
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? STAR_RADIUS : inner;
    const a = (i * Math.PI) / 5;
    return `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;
  });
  return `M${points.join("L")}Z`;
}

/**
 * The funders' logos side by side: "Co-funded by the European Union" with
 * the Erasmus+ project number, and IKY.
 *
 * The EU logo is inline SVG (like the AIOS Logo) so it can follow the theme:
 * its text is EU blue on light and white on dark (--color-eu-text), as in
 * the EU's own versions for light and dark backgrounds, and the project
 * lines take the normal text color. The flag keeps its official colors.
 * Each text line has a fixed `textLength`, so it fills the same width
 * whichever fallback font the browser ends up using.
 *
 * IKY's logo is the customer's image as it is: the blue square in a thin
 * white frame, which is how IKY shows it on dark backgrounds too (on light
 * ones the frame just blends in). Both logos are drawn at the same height,
 * set by the caller through `--funding-logo-height` (default 40px).
 */
export function FundingLogos({ className }: Props) {
  return (
    <div className={[styles.logos, className].filter(Boolean).join(" ")}>
      <svg
        className={styles.eu}
        viewBox="0 0 1350 456"
        role="img"
        aria-label={`Co-funded by the European Union. ${PROJECT} ${PROJECT_ID}`}
      >
        <rect className={styles.flag} {...FLAG} />
        <path className={styles.stars} d={STARS} />
        <g className={styles.statement}>
          <text x="465" y="113" textLength="596" lengthAdjust="spacingAndGlyphs">
            Co-funded by
          </text>
          <text x="465" y="225" textLength="875" lengthAdjust="spacingAndGlyphs">
            the European Union
          </text>
        </g>
        <g className={styles.project}>
          <text x="8" y="365" textLength="588" lengthAdjust="spacingAndGlyphs">
            {PROJECT}
          </text>
          <text x="8" y="441" textLength="986" lengthAdjust="spacingAndGlyphs">
            {PROJECT_ID}
          </text>
        </g>
      </svg>
      <img className={styles.iky} src={ikyLogo} alt="IKY – State Scholarships Foundation" />
    </div>
  );
}

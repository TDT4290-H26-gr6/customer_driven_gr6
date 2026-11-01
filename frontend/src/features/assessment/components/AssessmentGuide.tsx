import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/shared/components/Button";
import { MOBILE_MAX_WIDTH } from "@/shared/lib/breakpoints";
import type { GuideStep } from "../assessmentGuide";
import styles from "./AssessmentGuide.module.css";

type Props = {
  steps: GuideStep[];
  /** "done": went through every step; "skipped": closed it early (Skip or Escape). */
  onClose: (reason: "done" | "skipped") => void;
};

/** Space between the highlighted element and the spotlight's edge. */
const SPOTLIGHT_PADDING = 8;
/** Space between the spotlight and the explanation box. */
const GAP = 12;
/** Below this much free space above and below the target, the box docks to the bottom of the screen. */
const MIN_SPACE = 220;
const BOX_WIDTH = 380;
const EDGE = 16;
const FOCUSABLE = "button:not([disabled])";

type Rect = { top: number; left: number; width: number; height: number };

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

/** Where the explanation box goes: beside the spotlight where there's room, else docked at the bottom. */
function boxPosition(rect: Rect | null): CSSProperties {
  if (!rect) return {}; // centred by CSS
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const narrow = vw <= MOBILE_MAX_WIDTH;
  const horizontal: CSSProperties = narrow
    ? { left: EDGE, right: EDGE }
    : {
        width: BOX_WIDTH,
        left: Math.min(
          Math.max(EDGE, rect.left + rect.width / 2 - BOX_WIDTH / 2),
          vw - BOX_WIDTH - EDGE,
        ),
      };

  const spaceBelow = vh - (rect.top + rect.height);
  const spaceAbove = rect.top;
  if (Math.max(spaceBelow, spaceAbove) < MIN_SPACE) return { ...horizontal, bottom: EDGE };
  return spaceBelow >= spaceAbove
    ? { ...horizontal, top: rect.top + rect.height + GAP }
    : { ...horizontal, bottom: vh - rect.top + GAP };
}

/**
 * A step-by-step guide laid over the assessment page: each step dims the page,
 * highlights one control (found by its `data-guide` attribute) and explains it
 * in a small box beside it. A step without a target, or whose control isn't on
 * the page, is shown as a centred card instead.
 *
 * It's a modal dialog: clicks on the page underneath are blocked, focus starts
 * on the main button and Tab stays inside the box, and Escape skips the guide,
 * like ExitAssessmentDialog.
 */
export function AssessmentGuide({ steps, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Follow the step's target: scroll it into view, then keep the spotlight on
  // it while the page scrolls (the scroll itself included) or resizes.
  useLayoutEffect(() => {
    const target = step.target
      ? document.querySelector<HTMLElement>(`[data-guide="${step.target}"]`)
      : null;
    if (!target) {
      setRect(null);
      return;
    }
    target.scrollIntoView?.({
      block: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    const update = () => {
      const r = target.getBoundingClientRect();
      setRect({
        top: r.top - SPOTLIGHT_PADDING,
        left: r.left - SPOTLIGHT_PADDING,
        width: r.width + SPOTLIGHT_PADDING * 2,
        height: r.height + SPOTLIGHT_PADDING * 2,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step.target]);

  // Each new step starts on its main button, so Enter always moves forward.
  useEffect(() => {
    boxRef.current?.querySelector<HTMLElement>("[data-guide-primary]")?.focus();
  }, [index]);

  // Escape skips; Tab and Shift+Tab wrap around inside the box.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose("skipped");
        return;
      }
      if (e.key !== "Tab" || !boxRef.current) return;
      const focusable = [...boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const inside = boxRef.current.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function next() {
    if (isLast) onClose("done");
    else setIndex((i) => i + 1);
  }

  return (
    <div className={styles.overlay} role="presentation">
      {rect ? (
        <div
          className={styles.spotlight}
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          data-testid="guide-spotlight"
        />
      ) : (
        <div className={styles.scrim} />
      )}

      <div
        ref={boxRef}
        className={rect ? styles.box : `${styles.box} ${styles.centred}`}
        style={boxPosition(rect)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
      >
        <p className={styles.counter}>
          Step {index + 1} of {steps.length}
        </p>
        <h2 id={titleId} className={styles.title}>
          {step.title}
        </h2>
        <p id={bodyId} className={styles.body}>
          {step.body}
        </p>
        {step.rules && (
          <ul className={styles.rules}>
            {step.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        )}

        <div className={styles.actions}>
          {!isLast && (
            <button type="button" className={styles.skip} onClick={() => onClose("skipped")}>
              Skip guide
            </button>
          )}
          <span className={styles.spacer} />
          {/* "Previous", not "Back": the guide itself explains that Back
              may not exist in the assessment. */}
          {index > 0 && (
            <Button variant="secondary" onClick={() => setIndex((i) => i - 1)}>
              Previous
            </Button>
          )}
          <Button data-guide-primary onClick={next}>
            {isLast ? "Start answering" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, RouteIcon } from "@/shared/components/icons";
import type { LearningJourney } from "../types";
import {
  bannerGradient,
  COVERAGE_LABEL,
  coreSectionCodes,
  sortedSections,
  splitName,
} from "./journeyDisplay";
import styles from "./JourneyDetailsDialog.module.css";

type Props = {
  journey: LearningJourney;
  /** The card's position in the list — picks the banner colour, as on the card. */
  index: number;
  onClose: () => void;
  onAssess: () => void;
  /** This journey's assessment is starting. */
  starting: boolean;
  /** Any journey's assessment is starting, or there's nothing to assess. */
  assessDisabled: boolean;
};

const FOCUSABLE = "button:not([disabled]), a[href]";

/**
 * A journey's full details in a card centred on the screen. Closes on the X,
 * on Escape, or on a click anywhere outside the card; Tab stays inside it, and
 * focus goes back to the "Read more" button that opened it. Rendered into
 * document.body: the journey card lifts with a transform on hover, which would
 * otherwise turn this fixed overlay into one positioned inside the card.
 */
export function JourneyDetailsDialog({
  journey,
  index,
  onClose,
  onAssess,
  starting,
  assessDisabled,
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { code, title } = splitName(journey.name);
  const sections = sortedSections(journey);
  const core = coreSectionCodes(journey);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  // On the document so Escape and Tab work wherever focus happens to be.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const inside = dialogRef.current.contains(document.activeElement);
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

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.banner} style={{ backgroundImage: bannerGradient(index) }}>
          <RouteIcon className={styles.bannerIcon} width={32} height={32} />
          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.badgeRow}>
            {code && <span className={styles.codeBadge}>{code}</span>}
            <span className={styles.typeBadge}>Learning journey</span>
          </div>

          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {journey.description && <p className={styles.description}>{journey.description}</p>}

          <dl className={styles.factRow}>
            <div className={styles.fact}>
              <dt>Core sections</dt>
              <dd>{core.length > 0 ? core.join(", ") : "-"}</dd>
            </div>
            {sections.length > 0 && (
              <div className={styles.fact}>
                <dt>Sections covered</dt>
                <dd>{sections.length}</dd>
              </div>
            )}
            {journey.modules.length > 0 && (
              <div className={styles.fact}>
                <dt>Steps</dt>
                <dd>{journey.modules.length}</dd>
              </div>
            )}
          </dl>

          {sections.length > 0 && (
            <>
              <p className={styles.detailHeading}>What it covers</p>
              <ul className={styles.coverage}>
                {sections.map((s) => (
                  <li key={s.sectionId} className={styles.coverageRow}>
                    <span className={styles.sectionCode}>{s.section?.code ?? "-"}</span>
                    <span className={styles.sectionName}>{s.section?.name}</span>
                    <span className={styles[`coverage${s.coverageLevel}`]}>
                      {COVERAGE_LABEL[s.coverageLevel!]}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={styles.hint}>
                Assessing this journey asks the questions in its core sections.
              </p>
            </>
          )}

          {journey.modules.length > 0 && (
            <>
              <p className={styles.detailHeading}>Steps</p>
              <ol className={styles.steps}>
                {journey.modules.map((module) => (
                  <li key={module.id}>
                    <strong>{module.title}</strong>
                    {module.description && (
                      <span className={styles.stepDescription}> — {module.description}</span>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.assessButton}
            onClick={onAssess}
            disabled={assessDisabled}
          >
            {starting ? "Starting…" : "Assess this journey"}
          </button>
          {journey.moodleUrl && (
            <a
              href={journey.moodleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.externalLink}
            >
              Open in Moodle ↗
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

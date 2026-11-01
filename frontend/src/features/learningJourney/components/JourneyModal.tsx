import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, RouteIcon } from "@/shared/components/icons";
import { useDialogKeys } from "@/shared/hooks/useDialogKeys";
import type { LearningJourney } from "../types";
import {
  bannerGradient,
  COVERAGE_LABEL,
  coreSectionCodes,
  sortedSections,
  splitName,
} from "./journeyDisplay";
import styles from "./JourneyModal.module.css";
import { isWebLink } from "@/shared/lib/webLink";

type Props = {
  journey: LearningJourney;
  /** The card's position in the list: keeps the banner colour the card has. */
  index: number;
  onClose: () => void;
  /** Starts a journey assessment, on its core (M) sections. */
  onAssess: () => void;
  starting: boolean;
  assessDisabled: boolean;
};

/**
 * One journey in focus: what it covers, its steps, and the actions. Opened
 * from a JourneyCard; the X, a click outside it and Escape close it. Rendered
 * into <body> like the other dialogs.
 */
export function JourneyModal({
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
    closeRef.current?.focus();
  }, []);
  useDialogKeys(dialogRef, onClose);

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
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close journey"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.badgeRow}>
            {code && <span className={styles.codeBadge}>{code}</span>}
            <span className={styles.typeBadge}>Learning journey</span>
          </div>

          <h2 id={titleId} className={styles.name}>
            {title}
          </h2>
          {journey.description && <p className={styles.subtitle}>{journey.description}</p>}

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
              <h3 className={styles.detailHeading}>What it covers</h3>
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
              <h3 className={styles.detailHeading}>Steps</h3>
              <ol className={styles.steps}>
                {journey.modules.map((module) => (
                  <li key={module.id}>
                    <strong>{module.title}</strong>
                    {module.description && (
                      <span className={styles.stepDescription}>: {module.description}</span>
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
          {isWebLink(journey.moodleUrl) && (
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

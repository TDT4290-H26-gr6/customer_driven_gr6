import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useDialogKeys } from "@/shared/hooks/useDialogKeys";
import { LETTER_QUESTION, LETTER_TITLE, letterSections } from "../informationLetterContent";
import styles from "./InformationLetterModal.module.css";

/**
 * The information letter, as a modal. A click on the backdrop, the X or
 * Escape closes it; Tab stays inside. Same behaviour as FeedbackDialog (useDialogKeys), and
 * rendered into <body> so it covers the page whatever form or card it was
 * opened from.
 */
export function InformationLetterModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

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
        <div className={styles.titleRow}>
          <h2 id={titleId} className={styles.title}>
            {LETTER_TITLE}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close information letter"
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.question}>{LETTER_QUESTION}</p>
          {letterSections.map((section) => (
            <section key={section.heading} className={styles.section}>
              <h3 className={styles.sectionHeading}>{section.heading}</h3>
              {section.paragraphs?.map((text) => (
                <p key={text}>{text}</p>
              ))}
              {section.bullets && (
                <ul>
                  {section.bullets.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              )}
              {section.link && (
                <p>
                  <a href={section.link} target="_blank" rel="noreferrer">
                    {section.link}
                  </a>
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

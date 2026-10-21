import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { LETTER_QUESTION, LETTER_TITLE, letterSections } from "../informationLetterContent";
import styles from "./InformationLetterModal.module.css";

const FOCUSABLE = "button:not([disabled]), [href]";

/**
 * The information letter, as a modal. A click on the backdrop, the X or
 * Escape closes it; Tab stays inside. Same behaviour as FeedbackDialog, and
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

  // On the document, so Escape and Tab work wherever focus is.
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

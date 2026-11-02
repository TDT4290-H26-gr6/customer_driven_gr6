import { useEffect, useId, useRef } from "react";
import { Button } from "@/shared/components/Button";
import { RATINGS } from "../ratings";
import { MAX_FEEDBACK_LENGTH } from "../types";
import styles from "./FeedbackDialog.module.css";

export type FeedbackDraft = { message: string; suggestion: string; rating: number | null };
export type FeedbackStatus = "idle" | "sending" | "sent" | "error";

type Props = {
  draft: FeedbackDraft;
  onDraftChange: (draft: FeedbackDraft) => void;
  status: FeedbackStatus;
  onSubmit: () => void;
  /** Clears the "sent" state so the tester can write another one. */
  onWriteAnother: () => void;
  onClose: () => void;
};

const FOCUSABLE = "button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href]";

/**
 * The feedback form, as a modal. Presentational: FeedbackWidget owns the
 * draft, so closing and reopening doesn't lose what the tester typed.
 * Escape and a click on the backdrop close it; Tab stays inside it.
 */
export function FeedbackDialog({
  draft,
  onDraftChange,
  status,
  onSubmit,
  onWriteAnother,
  onClose,
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const ratingName = useId();
  const sent = status === "sent";
  const sending = status === "sending";
  // A face, a few words, or both.
  const canSubmit = (draft.message.trim() !== "" || draft.rating !== null) && !sending;

  // Put focus in the dialog on open (on the faces, the first question), and
  // on the "thanks" screen once sent.
  useEffect(() => {
    if (sent) dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    else firstFieldRef.current?.focus();
  }, [sent]);

  // Escape closes; Tab and Shift+Tab wrap around inside the dialog. On the
  // document, like Header's menu, so it works wherever focus is.
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

  return (
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
            {sent ? "Thank you!" : "Share your feedback"}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close feedback"
          >
            ×
          </button>
        </div>

        {sent ? (
          <>
            <p className={styles.hint}>
              Your feedback has been sent to the team. It helps us make AIOS better.
            </p>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={onWriteAnother}>
                Send more feedback
              </Button>
              <Button onClick={onClose}>Close</Button>
            </div>
          </>
        ) : (
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) onSubmit();
            }}
          >
            <p className={styles.hint}>
              You&apos;re testing an early version of AIOS. Pick a face, tell us what could be
              better, or both. A couple of sentences is plenty.
            </p>

            <fieldset className={styles.rating} disabled={sending}>
              <legend className={styles.label}>
                How satisfied are you with AIOS overall?{" "}
                <span className={styles.optional}>(optional)</span>
              </legend>
              <div className={styles.faces}>
                {RATINGS.map((r, i) => (
                  <label key={r.value} className={styles.face} title={r.label}>
                    <input
                      ref={i === 0 ? firstFieldRef : undefined}
                      type="radio"
                      name={ratingName}
                      value={r.value}
                      checked={draft.rating === r.value}
                      onChange={() => onDraftChange({ ...draft, rating: r.value })}
                      aria-label={r.label}
                    />
                    <span className={styles.faceEmoji} aria-hidden="true">
                      {r.face}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className={styles.field}>
              <span className={styles.label}>
                What should be improved?{" "}
                {draft.rating !== null && <span className={styles.optional}>(optional)</span>}
              </span>
              <textarea
                className={styles.textarea}
                value={draft.message}
                onChange={(e) => onDraftChange({ ...draft, message: e.target.value })}
                maxLength={MAX_FEEDBACK_LENGTH}
                disabled={sending}
                rows={4}
                placeholder="E.g. I wasn't sure what the score on the dashboard meant."
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>
                How would you improve it? <span className={styles.optional}>(optional)</span>
              </span>
              <textarea
                className={styles.textarea}
                value={draft.suggestion}
                onChange={(e) => onDraftChange({ ...draft, suggestion: e.target.value })}
                maxLength={MAX_FEEDBACK_LENGTH}
                disabled={sending}
                rows={3}
                placeholder="E.g. A short explanation next to the score."
              />
            </label>

            {status === "error" && (
              <p className={styles.error} role="alert">
                Could not send your feedback. Please try again.
              </p>
            )}

            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={onClose} disabled={sending}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {sending ? "Sending…" : "Send feedback"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

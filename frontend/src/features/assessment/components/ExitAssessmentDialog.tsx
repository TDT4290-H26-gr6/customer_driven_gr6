import { useEffect, useId, useRef } from "react";
import { Button } from "@/shared/components/Button";
import styles from "./ExitAssessmentDialog.module.css";

export type ExitStatus = "idle" | "leaving" | "discarding";

type Props = {
  /** Answers whose save failed — Save & exit retries them before leaving. */
  unsavedCount: number;
  status: ExitStatus;
  error: string | null;
  onKeepGoing: () => void;
  onSaveAndExit: () => void;
  onDiscard: () => void;
};

const FOCUSABLE = "button:not([disabled])";

/**
 * Asks what leaving mid-assessment should do. Presentational:
 * AssessmentRunnerPage owns the saving/deleting. Escape and a click on the
 * backdrop mean "keep going" (not while a leave is in progress); Tab stays
 * inside it. Focus starts on "Keep going" so a stray Enter never deletes.
 */
export function ExitAssessmentDialog({
  unsavedCount,
  status,
  error,
  onKeepGoing,
  onSaveAndExit,
  onDiscard,
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const busy = status !== "idle";

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
  }, []);

  // Escape closes; Tab and Shift+Tab wrap around inside the dialog. On the
  // document, like FeedbackDialog's, so it works wherever focus is.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!busy) onKeepGoing();
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
  }, [busy, onKeepGoing]);

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onKeepGoing();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className={styles.title}>
          Leave the assessment?
        </h2>

        <p className={styles.hint}>
          Save &amp; exit keeps your answers so you can continue later from where you stopped. Abort
          deletes every answer in this assessment, so you&apos;ll start from the first question next
          time.
        </p>

        {unsavedCount > 0 && (
          <p className={styles.warning}>
            {unsavedCount === 1 ? "1 answer hasn't" : `${unsavedCount} answers haven't`} been saved
            yet. Save &amp; exit will try again before leaving.
          </p>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <Button variant="danger" onClick={onDiscard} disabled={busy}>
            {status === "discarding" ? "Deleting…" : "Abort and delete answers"}
          </Button>
          <span className={styles.spacer} />
          <Button data-initial-focus variant="secondary" onClick={onKeepGoing} disabled={busy}>
            Keep going
          </Button>
          <Button onClick={onSaveAndExit} disabled={busy}>
            {status === "leaving" ? "Saving…" : "Save & exit"}
          </Button>
        </div>
      </div>
    </div>
  );
}

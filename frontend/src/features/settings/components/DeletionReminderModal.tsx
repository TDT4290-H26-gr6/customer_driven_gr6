import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { cancelAccountDeletion, getToken } from "@/features/auth";
import { Button } from "@/shared/components/Button";
import { useDialogKeys } from "@/shared/hooks/useDialogKeys";
import styles from "./DeletionReminderModal.module.css";

/**
 * Set once the learner has answered, so reloading the page doesn't ask
 * again. Holds the end of the session token (its signature — not enough to
 * use as one): a new sign-in gets a new token, and is asked again.
 */
const ANSWERED_KEY = "aios.deletionReminderAnswered";

/**
 * Set by "Do not remind me again": never ask again on this browser about
 * this learner's deletion. Holds the learner and the scheduled date, so a
 * deletion scheduled later (after cancelling this one) is asked about again.
 */
const MUTED_KEY = "aios.deletionReminderMuted";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "in 12 days", counting a part day as a whole one. "today" once the date
 * has passed: the backend deletes the data within the hour.
 */
function timeLeft(scheduledFor: string): string {
  const days = Math.ceil((new Date(scheduledFor).getTime() - Date.now()) / DAY_MS);
  if (days <= 0) return "today";
  return days === 1 ? "in 1 day" : `in ${days} days`;
}

function sessionMark(): string {
  return getToken()?.slice(-16) ?? "";
}

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value);
  } catch {
    // Storage blocked: the worst case is being asked again.
  }
}

/**
 * Asks a learner who comes back with a deletion pending (CD-124) whether
 * they still want it. Decided once, when AppShell mounts — i.e. when a
 * session starts (sign-in, or reopening the app) — so scheduling the
 * deletion in Settings doesn't immediately ask about it.
 */
export function DeletionReminderModal() {
  const { learner } = useAuth();
  // The date it asks about, kept from the start: once "No" cancels the
  // deletion the learner has none, but the dialog stays up to confirm that.
  const [scheduledFor] = useState(learner?.deletionScheduledFor ?? null);
  const muteMark = `${learner?.id}:${scheduledFor}`;
  const [open, setOpen] = useState(
    () =>
      scheduledFor !== null &&
      read(() => sessionStorage, ANSWERED_KEY) !== sessionMark() &&
      read(() => localStorage, MUTED_KEY) !== muteMark,
  );

  if (!open || scheduledFor === null) return null;

  return (
    <ReminderDialog
      scheduledFor={scheduledFor}
      onDone={(muted) => {
        write(() => sessionStorage, ANSWERED_KEY, sessionMark());
        if (muted) write(() => localStorage, MUTED_KEY, muteMark);
        setOpen(false);
      }}
    />
  );
}

/**
 * The dialog itself, mounted only while open (so its Escape handler is too).
 * Escape, the backdrop and "Yes" all leave the deletion as it is; only
 * "No, keep my account" changes anything, and the dialog then confirms it
 * before closing.
 */
function ReminderDialog({
  scheduledFor,
  onDone,
}: {
  scheduledFor: string;
  onDone: (muted: boolean) => void;
}) {
  const { updateLearner } = useAuth();
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kept, setKept] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  function keepAccount() {
    setBusy(true);
    setError("");
    cancelAccountDeletion()
      .then((updated) => {
        updateLearner(updated);
        setKept(true);
      })
      .catch(() => setError("Could not cancel the deletion. Try again."))
      .finally(() => setBusy(false));
  }

  const close = () => onDone(muted);

  // Focus starts on the first button: "No, keep my account" (the safe
  // answer), then "OK" on the confirmation.
  useEffect(() => {
    dialogRef.current?.querySelector("button")?.focus();
  }, [kept]);

  useDialogKeys(dialogRef, close);

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {kept ? (
          <>
            <div className={styles.confirmed} aria-hidden="true">
              ✓
            </div>
            <h2 id={titleId} className={styles.title}>
              Your account will not be deleted
            </h2>
            <p className={styles.text} role="status">
              The deletion has been cancelled. You can delete your account again at any time in
              Settings.
            </p>
            <div className={styles.actions}>
              <Button onClick={close}>OK</Button>
            </div>
          </>
        ) : (
          <>
            <h2 id={titleId} className={styles.title}>
              Your account is scheduled for deletion {timeLeft(scheduledFor)}
            </h2>
            <p className={styles.text}>Do you still want to delete your account?</p>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={muted}
                onChange={(e) => setMuted(e.target.checked)}
                disabled={busy}
              />
              <span>Do not remind me again</span>
            </label>
            <div className={styles.actions}>
              <Button onClick={keepAccount} disabled={busy}>
                {busy ? "Cancelling…" : "No, keep my account"}
              </Button>
              <Button variant="secondary" onClick={close} disabled={busy}>
                Yes, delete it
              </Button>
            </div>
            {error && <p className={styles.error}>{error}</p>}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

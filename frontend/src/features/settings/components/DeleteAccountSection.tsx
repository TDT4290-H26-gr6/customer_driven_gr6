import { useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/shared/components/Button";
import { DATE_FORMAT } from "@/shared/lib/format";
import { cancelAccountDeletion, scheduleAccountDeletion } from "@/features/auth";
import styles from "./DeleteAccountSection.module.css";

/**
 * Account deletion (CD-60, CD-124): "Delete account" schedules the deletion
 * of the learner's personal data 30 days out, and they stay signed in so
 * they can cancel until then. Their assessment answers and scores are kept
 * for the research either way.
 */
export function DeleteAccountSection() {
  const { learner, updateLearner } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function run(request: typeof scheduleAccountDeletion, failure: string) {
    setBusy(true);
    setError("");
    request()
      .then((updated) => {
        updateLearner(updated);
        setConfirming(false);
      })
      .catch(() => setError(failure))
      .finally(() => setBusy(false));
  }

  const scheduledFor = learner?.deletionScheduledFor;

  return (
    <div className={styles.wrap}>
      <h2 className={styles.heading}>Delete account</h2>

      {scheduledFor ? (
        <>
          <p className={styles.hint}>
            Your account is scheduled for deletion on{" "}
            <strong>{DATE_FORMAT.format(new Date(scheduledFor))}</strong>. Your name, email, Google
            sign-in, background, goals and advice will then be deleted. Until then you can keep
            using AIOS and cancel the deletion.
          </p>
          {!confirming ? (
            <div className={styles.actions}>
              <Button variant="secondary" onClick={() => setConfirming(true)}>
                Cancel deletion
              </Button>
            </div>
          ) : (
            <div className={`${styles.confirmBox} ${styles.confirmBoxNeutral}`}>
              <p className={styles.confirmText}>
                Keep your account? The scheduled deletion will be cancelled.
              </p>
              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                  Back
                </Button>
                <Button
                  onClick={() =>
                    run(cancelAccountDeletion, "Could not cancel the deletion. Try again.")
                  }
                  disabled={busy}
                >
                  {busy ? "Cancelling…" : "Yes, keep my account"}
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <p className={styles.hint}>
            Deletes your personal data: your name, email, Google sign-in, background, goals and
            advice. This happens 30 days after you confirm, and you can cancel until then.
          </p>

          {!confirming ? (
            <div className={styles.actions}>
              <Button
                variant="secondary"
                className={styles.dangerButton}
                onClick={() => setConfirming(true)}
              >
                Delete account
              </Button>
            </div>
          ) : (
            <div className={styles.confirmBox}>
              <p className={styles.confirmText}>
                Are you sure? Your personal data will be deleted in 30 days.
              </p>
              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    run(scheduleAccountDeletion, "Could not delete your account. Try again.")
                  }
                  disabled={busy}
                >
                  {busy ? "Deleting…" : "Yes, delete my account"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

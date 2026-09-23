import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { Button } from "@/shared/components/Button";
import { deleteAccount } from "@/features/auth";
import styles from "./DeleteAccountSection.module.css";

/** GDPR right-to-erasure (CD-60): permanently deletes the account and everything tied to it. */
export function DeleteAccountSection() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  function handleDelete() {
    setDeleting(true);
    setError("");
    deleteAccount()
      .then(() => {
        logout();
        navigate("/login", { replace: true });
      })
      .catch(() => {
        setError("Could not delete your account. Try again.");
        setDeleting(false);
      });
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.heading}>Delete account</h2>
      <p className={styles.hint}>
        Permanently deletes your account and everything tied to it — your assessments, scores, and
        profile. This can&apos;t be undone.
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
          <p className={styles.confirmText}>Are you sure? This is permanent.</p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button className={styles.dangerButton} onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Yes, delete my account"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

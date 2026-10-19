import { useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { acceptPrivacyNotice } from "@/features/auth";
import { Button } from "@/shared/components/Button";
import styles from "./PrivacyNoticeModal.module.css";

/**
 * Blocking modal shown after the learner saves their profile ("Done" on the
 * initial profile step), until they have acknowledged the privacy notice. The
 * learner already gave consent in a separate consent form, so this is only a
 * reminder. Like RoleGateModal it has no close button, no backdrop
 * dismiss and no Escape handling; AppShell makes the rest of the app `inert`
 * while it is up. The acknowledgement is stored on the learner, so it shows
 * once per account.
 */
export function PrivacyNoticeModal() {
  const { updateLearner } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleAccept() {
    setSaving(true);
    setError("");
    acceptPrivacyNotice()
      .then(updateLearner)
      .catch(() => {
        setError("Could not save your acknowledgement. Try again.");
        setSaving(false);
      });
  }

  return (
    <div className={styles.backdrop} role="presentation">
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-notice-heading"
      >
        <h2 id="privacy-notice-heading" className={styles.heading}>
          Privacy notice
        </h2>
        <p className={styles.text}>
          By continuing, you consent to us processing your profile details and your assessment
          answers. We use them to show your results, recommend learning journeys, and improve this
          service.
        </p>
        <p className={styles.text}>
          You can request deletion of your account and personal data at any time from the settings
          page. We will process the request within 30 days.
        </p>
        <div className={styles.actions}>
          <Button onClick={handleAccept} disabled={saving}>
            {saving ? "Saving…" : "I understand"}
          </Button>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

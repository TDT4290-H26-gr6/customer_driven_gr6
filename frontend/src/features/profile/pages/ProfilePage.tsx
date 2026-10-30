import { useNavigate } from "react-router-dom";
import { ProfileForm } from "../components/ProfileForm";
import styles from "./ProfilePage.module.css";

/**
 * Where RequireProfile sends a learner whose profile isn't complete. Not in
 * the sidebar, later edits happen in Settings. "Done" saves and goes to
 * the dashboard, where the assessment button now lets them through.
 */
export function ProfilePage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Before you start</h1>
      <p className={styles.subheading}>
        Fill in your profile before taking the self-assessment. You can change it later in Settings.
      </p>

      <div className={styles.card}>
        <ProfileForm
          submitLabel="Done"
          requireConsent
          onSaved={() => navigate("/", { replace: true })}
        />
      </div>
    </div>
  );
}

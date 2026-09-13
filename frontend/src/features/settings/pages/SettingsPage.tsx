import { useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { RoleSelect } from "@/features/onboarding";
import type { Role } from "@/features/onboarding";
import styles from "./SettingsPage.module.css";

/**
 * Account settings. For now this only covers changing your role — more
 * sections land here later (see context/frontend-structure.md).
 */
export function SettingsPage() {
  const { learner, setRole } = useAuth();
  const [saved, setSaved] = useState<Role | null>(null);

  function handleRoleChange(role: Role) {
    setRole(role);
    setSaved(role);
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Settings</h1>
      <div className={styles.card}>
        <RoleSelect
          initialRoleId={learner?.role?.id}
          heading="Your role"
          description="Change the role that best describes you."
          confirmLabel="Save"
          onDone={handleRoleChange}
        />
        {saved && <p className={styles.confirmation}>Saved — you're now set as {saved.name}.</p>}
      </div>
    </div>
  );
}

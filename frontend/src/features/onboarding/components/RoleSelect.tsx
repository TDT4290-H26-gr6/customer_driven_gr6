import { useEffect, useState } from "react";
import { Button } from "@/shared/components/Button";
import { getRoles, setMyRole } from "../api";
import type { Role } from "../types";
import styles from "./RoleSelect.module.css";

type Props = {
  onDone: (role: Role) => void;
  /** Preselect an existing role instead of defaulting to the first option — used by Settings. */
  initialRoleId?: string;
  heading?: string;
  description?: string;
  confirmLabel?: string;
};

/** Dropdown + confirm button for choosing a role. Reused by onboarding and settings. */
export function RoleSelect({
  onDone,
  initialRoleId,
  heading = "Choose your role",
  description = "Pick the role that best describes you to start your learning journey.",
  confirmLabel = "Confirm",
}: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState(initialRoleId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getRoles()
      .then((data) => {
        setRoles(data);
        if (!initialRoleId && data[0]) setSelected(data[0].id);
      })
      .catch(() => setError("Could not load roles."));
  }, [initialRoleId]);

  function confirm() {
    if (!selected) return;
    setSaving(true);
    setError("");
    setMyRole(selected)
      .then((me) => onDone(me.role))
      .catch(() => setError("Could not save your role. Try again."))
      .finally(() => setSaving(false));
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.heading}>{heading}</h2>
      <p className={styles.hint}>{description}</p>
      <select
        className={styles.select}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={roles.length === 0 || saving}
      >
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <div>
        <Button onClick={confirm} disabled={saving || !selected}>
          {saving ? "Saving…" : confirmLabel}
        </Button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

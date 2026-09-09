import { useEffect, useState } from "react";
import { getRoles, setMyRole } from "../api";
import type { Role } from "../types";

export function RoleSelect({ onDone }: { onDone: (role: Role) => void }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getRoles()
      .then((data) => {
        setRoles(data);
        if (data[0]) setSelected(data[0].id);
      })
      .catch(() => setError("Could not load roles."));
  }, []);

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
    <div style={{ maxWidth: 360 }}>
      <h2>Choose your role</h2>
      <p style={{ color: "#555" }}>
        Pick the role that best describes you to start your learning journey.
      </p>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={roles.length === 0 || saving}
        style={{ padding: "0.5rem", fontSize: "1rem", width: "100%" }}
      >
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={confirm}
          disabled={saving || !selected}
          style={{ padding: "0.5rem 1rem", fontSize: "1rem" }}
        >
          {saving ? "Saving…" : "Confirm"}
        </button>
      </div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}

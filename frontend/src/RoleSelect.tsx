import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

type Role = { id: string; name: string };

export function RoleSelect({
  token,
  onDone,
}: {
  token: string;
  onDone: (role: Role) => void;
}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/roles`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: Role[]) => {
        setRoles(data);
        if (data[0]) setSelected(data[0].id);
      })
      .catch(() => setError("Could not load roles."));
  }, [token]);

  function confirm() {
    if (!selected) return;
    setSaving(true);
    setError("");
    fetch(`${API_URL}/auth/me/role`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ roleId: selected }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
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

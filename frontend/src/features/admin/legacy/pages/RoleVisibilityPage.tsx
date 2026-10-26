import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { getVisibility } from "../../api";
import type { VisibilityMatrix } from "../../types";
import { GrantChecklist } from "../components/GrantChecklist";
import { setCompetenceGrant, setSectionGrant } from "../api";
import styles from "./RoleVisibilityPage.module.css";

type Kind = "section" | "competence";

/**
 * LEGACY — not routed. Role-based visibility is switched off
 * (config.roleSelectionEnabled), so this screen is parked here instead of
 * deleted. The backend endpoints it uses (/admin/visibility, /admin/roles/...)
 * are untouched; to bring it back, import it from "@/features/admin/legacy"
 * and add `<Route path="/admin/roles" element={<RoleVisibilityPage />} />`
 * under RequireAdmin in routes.tsx (plus a button on the admin page).
 *
 * Pick a role, then tick the sections and competences it may see.
 * A role sees a question if it's granted the question's competence OR the
 * section its module sits in — and nothing at all until something is granted.
 * Each click is saved straight away.
 */
export function RoleVisibilityPage() {
  const navigate = useNavigate();
  const [matrix, setMatrix] = useState<VisibilityMatrix | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    getVisibility()
      .then((loaded) => {
        setMatrix(loaded);
        setRoleId((current) => current || loaded.roles[0]?.id || "");
      })
      .catch(() => setLoadFailed(true));
  }, []);

  const grantedSectionIds = useMemo(
    () => new Set(matrix?.roleSections.filter((g) => g.roleId === roleId).map((g) => g.sectionId)),
    [matrix, roleId],
  );
  const grantedCompetenceIds = useMemo(
    () =>
      new Set(
        matrix?.roleCompetences.filter((g) => g.roleId === roleId).map((g) => g.competenceId),
      ),
    [matrix, roleId],
  );

  function applyLocally(forRole: string, kind: Kind, itemId: string, granted: boolean) {
    setMatrix((prev) => {
      if (!prev) return prev;
      if (kind === "section") {
        const others = prev.roleSections.filter(
          (g) => !(g.roleId === forRole && g.sectionId === itemId),
        );
        return {
          ...prev,
          roleSections: granted ? [...others, { roleId: forRole, sectionId: itemId }] : others,
        };
      }
      const others = prev.roleCompetences.filter(
        (g) => !(g.roleId === forRole && g.competenceId === itemId),
      );
      return {
        ...prev,
        roleCompetences: granted ? [...others, { roleId: forRole, competenceId: itemId }] : others,
      };
    });
  }

  async function toggle(kind: Kind, itemId: string, granted: boolean) {
    const forRole = roleId;
    const key = `${kind}:${itemId}`;
    setError("");
    setPending((prev) => new Set(prev).add(key));
    applyLocally(forRole, kind, itemId, granted);

    try {
      const save = kind === "section" ? setSectionGrant : setCompetenceGrant;
      await save(forRole, itemId, granted);
    } catch {
      applyLocally(forRole, kind, itemId, !granted);
      setError("Could not save that change. Try again.");
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  if (loadFailed) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>Could not load the visibility settings.</p>
      </div>
    );
  }
  if (!matrix) return <Spinner />;

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.heading}>Role visibility</h1>
        <Button variant="secondary" onClick={() => navigate("/admin")}>
          Back to admin mode
        </Button>
      </div>
      <p className={styles.subheading}>
        Choose what each role can see. A role sees a question if it&apos;s granted the
        question&apos;s competence or the section it&apos;s in, and nothing until something is
        granted. Changes save as you click.
      </p>

      <label className={styles.roleField}>
        <span className={styles.roleLabel}>Role</span>
        <select
          className={styles.select}
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          disabled={matrix.roles.length === 0}
        >
          {matrix.roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.columns}>
        <GrantChecklist
          title="Sections"
          hint="The role sees every question in the section's modules."
          items={matrix.sections}
          grantedIds={grantedSectionIds}
          isPending={(id) => pending.has(`section:${id}`)}
          onToggle={(id, granted) => toggle("section", id, granted)}
        />
        <GrantChecklist
          title="Competences"
          hint="The role sees every question that assesses the competence."
          items={matrix.competences}
          grantedIds={grantedCompetenceIds}
          isPending={(id) => pending.has(`competence:${id}`)}
          onToggle={(id, granted) => toggle("competence", id, granted)}
        />
      </div>
    </div>
  );
}

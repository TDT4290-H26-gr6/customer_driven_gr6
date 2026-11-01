import { useState } from "react";
import { isApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { createCompetence, updateCompetence } from "../api";
import { plural } from "../questionTypes";
import type { CurriculumCompetence } from "../types";
import { ChangeHistory } from "./ChangeHistory";
import styles from "../pages/CurriculumPage.module.css";

type Props = {
  competences: CurriculumCompetence[];
  /** Called after a change, so the page reloads the curriculum. */
  onChanged: () => void;
};

type Draft = { id: string | null; name: string; description: string };

/**
 * The competences questions and modules assess: add one, or rename it and
 * change its description. A rename shows everywhere the competence appears,
 * results included, since they refer to it rather than copy its name.
 */
export function CompetencesPanel({ competences, onChanged }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const input = { name: draft.name, description: draft.description.trim() || null };
    try {
      if (draft.id) await updateCompetence(draft.id, input);
      else await createCompetence(input);
      setDraft(null);
      onChanged();
    } catch (err) {
      setError(
        isApiError(err) && err.status >= 400 && err.status < 500
          ? err.message
          : "Could not save the competence. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function form(heading: string) {
    if (!draft) return null;
    return (
      <form
        className={styles.subForm}
        aria-label={heading}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input
            className={styles.input}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            maxLength={191}
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Description (optional)</span>
          <textarea
            className={styles.textarea}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={2}
            maxLength={2000}
          />
        </label>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setDraft(null);
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !draft.name.trim()}>
            {saving ? "Saving…" : draft.id ? "Save changes" : "Add competence"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          Every question and module assesses one competence. Renaming one changes it everywhere,
          learners&apos; results included.
        </p>
        {draft?.id !== null && (
          <Button onClick={() => setDraft({ id: null, name: "", description: "" })}>
            Add competence
          </Button>
        )}
      </div>
      {draft?.id === null && form("New competence")}

      <ul className={styles.competenceList}>
        {competences.map((competence) => (
          <li key={competence.id} className={styles.card}>
            {draft?.id === competence.id ? (
              form(`Edit ${competence.name}`)
            ) : (
              <div className={styles.competence}>
                <div className={styles.questionText}>
                  <p className={styles.prompt}>{competence.name}</p>
                  {competence.description && (
                    <p className={styles.meta}>{competence.description}</p>
                  )}
                  <p className={styles.meta}>
                    {plural(competence.questionCount, "question")} · main competence of{" "}
                    {plural(competence.moduleCount, "module")}
                  </p>
                  <ChangeHistory history={competence.history} />
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setDraft({
                      id: competence.id,
                      name: competence.name,
                      description: competence.description ?? "",
                    })
                  }
                  aria-label={`Edit ${competence.name}`}
                >
                  Edit
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

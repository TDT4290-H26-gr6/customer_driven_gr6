import { useId, useState } from "react";
import { Button } from "@/shared/components/Button";
import type { CurriculumCompetence, CurriculumSection, ModuleInput } from "../types";
import styles from "../pages/CurriculumPage.module.css";

type Props = {
  heading: string;
  /** Adding a new module (the submit button says so) rather than editing one. */
  isNew?: boolean;
  initial: ModuleInput;
  /** Set when editing a module that has questions: moving it changes how past results read. */
  questionCount?: number;
  sections: CurriculumSection[];
  competences: CurriculumCompetence[];
  error: string | null;
  saving: boolean;
  onSave: (input: ModuleInput) => void;
  onCancel: () => void;
};

/**
 * Adds or edits a section module: the section it's in, its level (the step the
 * adaptive assessment asks it at), the competence it mainly teaches plus any
 * secondary ones, and its page in Moodle.
 */
export function ModuleForm({
  heading,
  isNew = false,
  initial,
  questionCount = 0,
  sections,
  competences,
  error,
  saving,
  onSave,
  onCancel,
}: Props) {
  const id = useId();
  const [form, setForm] = useState({ ...initial, level: initial.level?.toString() ?? "" });
  const set = (changes: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...changes }));

  function toggleSecondary(competenceId: string) {
    set({
      secondaryCompetenceIds: form.secondaryCompetenceIds.includes(competenceId)
        ? form.secondaryCompetenceIds.filter((c) => c !== competenceId)
        : [...form.secondaryCompetenceIds, competenceId],
    });
  }

  const moved =
    questionCount > 0 &&
    (form.sectionId !== initial.sectionId || form.level !== (initial.level?.toString() ?? ""));

  return (
    <form
      className={styles.subForm}
      aria-label={heading}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...form,
          name: form.name,
          description: form.description?.trim() || null,
          moodleUrl: form.moodleUrl?.trim() || null,
          level: form.level.trim() === "" ? null : Number(form.level),
          secondaryCompetenceIds: form.secondaryCompetenceIds.filter(
            (c) => c !== form.mainCompetenceId,
          ),
        });
      }}
    >
      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input
            className={styles.input}
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            maxLength={191}
            required
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Section</span>
          <select
            className={styles.select}
            value={form.sectionId}
            onChange={(e) => set({ sectionId: e.target.value })}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {`${s.code ?? ""} ${s.name}`.trim()}
              </option>
            ))}
          </select>
        </label>
        <label className={`${styles.field} ${styles.fieldNarrow}`}>
          <span className={styles.label}>Level (optional)</span>
          <input
            type="number"
            className={styles.input}
            min={1}
            max={20}
            value={form.level}
            onChange={(e) => set({ level: e.target.value })}
            aria-describedby={`${id}-level`}
          />
        </label>
      </div>
      <p id={`${id}-level`} className={styles.hint}>
        The assessment asks a section&apos;s modules in order of level, 1 first, and moves a learner
        up a level once they&apos;ve passed the one below.
      </p>
      {moved && (
        <p className={styles.notice}>
          This module has {questionCount === 1 ? "1 question" : `${questionCount} questions`}.
          Moving it or changing its level also changes how past results by section are shown, which
          are worked out from the current structure.
        </p>
      )}

      <label className={styles.field}>
        <span className={styles.label}>Main competence</span>
        <select
          className={styles.select}
          value={form.mainCompetenceId}
          onChange={(e) => set({ mainCompetenceId: e.target.value })}
        >
          {competences.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>Secondary competences (optional)</legend>
        <div className={styles.checkGrid}>
          {competences
            .filter((c) => c.id !== form.mainCompetenceId)
            .map((c) => (
              <label key={c.id} className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={form.secondaryCompetenceIds.includes(c.id)}
                  onChange={() => toggleSecondary(c.id)}
                />
                {c.name}
              </label>
            ))}
        </div>
      </fieldset>

      <label className={styles.field}>
        <span className={styles.label}>Link to its page in Moodle (optional)</span>
        <input
          type="url"
          className={styles.input}
          value={form.moodleUrl ?? ""}
          onChange={(e) => set({ moodleUrl: e.target.value })}
          maxLength={512}
          placeholder="https://moodle…"
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Description (optional)</span>
        <textarea
          className={styles.textarea}
          value={form.description ?? ""}
          onChange={(e) => set({ description: e.target.value })}
          rows={2}
          maxLength={5000}
        />
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !form.name.trim()}>
          {saving ? "Saving…" : isNew ? "Add module" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

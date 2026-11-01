import { useState } from "react";
import { Button } from "@/shared/components/Button";
import type { SectionInput } from "../types";
import styles from "../pages/CurriculumPage.module.css";

type Props = {
  heading: string;
  initial?: SectionInput;
  error: string | null;
  saving: boolean;
  onSave: (input: SectionInput) => void;
  onCancel: () => void;
};

/** Adds or edits a section: its name, short code ("A") and description. */
export function SectionForm({ heading, initial, error, saving, onSave, onCancel }: Props) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  return (
    <form
      className={styles.subForm}
      aria-label={heading}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ code: code.trim() || null, name, description: description.trim() || null });
      }}
    >
      <div className={styles.fields}>
        <label className={`${styles.field} ${styles.fieldNarrow}`}>
          <span className={styles.label}>Code (optional)</span>
          <input
            className={styles.input}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={10}
            placeholder="e.g. F"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={191}
            required
          />
        </label>
      </div>
      <label className={styles.field}>
        <span className={styles.label}>Description (optional)</span>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Saving…" : initial ? "Save changes" : "Add section"}
        </Button>
      </div>
    </form>
  );
}

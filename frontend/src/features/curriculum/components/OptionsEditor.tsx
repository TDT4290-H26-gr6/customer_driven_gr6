import { useId } from "react";
import { Button } from "@/shared/components/Button";
import { nextOptionId } from "../questionTypes";
import type { Option } from "../types";
import styles from "./Editors.module.css";

const MAX_OPTIONS = 12;
const MIN_OPTIONS = 2;

type Props = {
  options: Option[];
  correctIds: string[];
  /**
   * "single": exactly one correct (radio); "multi": any number (checkbox);
   * "order": no correct marks, the list's order is the correct order.
   */
  mode: "single" | "multi" | "order";
  /** Fixed options (true/false): only which one is correct can change. */
  fixed?: boolean;
  /** What an option is called in labels, e.g. "Option" or "Criterion". */
  noun?: string;
  onChange: (options: Option[], correctIds: string[]) => void;
};

/**
 * The options of a choice, criteria or ordering question: edit their text,
 * mark which are correct, reorder and add or remove them. Option ids never
 * change once made: learners' saved answers refer to them.
 */
export function OptionsEditor({
  options,
  correctIds,
  mode,
  fixed = false,
  noun = "Option",
  onChange,
}: Props) {
  const groupName = useId();

  function setText(index: number, text: string) {
    onChange(
      options.map((o, i) => (i === index ? { ...o, text } : o)),
      correctIds,
    );
  }

  function toggleCorrect(id: string) {
    if (mode === "single") return onChange(options, [id]);
    onChange(
      options,
      correctIds.includes(id) ? correctIds.filter((c) => c !== id) : [...correctIds, id],
    );
  }

  function move(index: number, by: -1 | 1) {
    const next = [...options];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next, correctIds);
  }

  function remove(index: number) {
    const id = options[index].id;
    onChange(
      options.filter((_, i) => i !== index),
      correctIds.filter((c) => c !== id),
    );
  }

  function add() {
    onChange([...options, { id: nextOptionId(options), text: "" }], correctIds);
  }

  return (
    <div className={styles.options}>
      {mode !== "order" && (
        <p className={styles.hint}>
          {mode === "single"
            ? "Select the correct answer."
            : `Tick every correct ${noun.toLowerCase()}.`}
        </p>
      )}
      <ol className={styles.optionList}>
        {options.map((option, index) => {
          const label = `${noun} ${index + 1}`;
          return (
            <li key={option.id} className={styles.optionRow}>
              {mode === "order" ? (
                <span className={styles.position} aria-hidden="true">
                  {index + 1}
                </span>
              ) : (
                <input
                  type={mode === "single" ? "radio" : "checkbox"}
                  name={groupName}
                  className={styles.correct}
                  checked={correctIds.includes(option.id)}
                  onChange={() => toggleCorrect(option.id)}
                  aria-label={`${label} is correct`}
                />
              )}
              <input
                type="text"
                className={styles.optionText}
                value={option.text}
                onChange={(e) => setText(index, e.target.value)}
                aria-label={`${label} text`}
                placeholder={label}
                maxLength={500}
                readOnly={fixed}
              />
              {!fixed && (
                <span className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${label.toLowerCase()} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => move(index, 1)}
                    disabled={index === options.length - 1}
                    aria-label={`Move ${label.toLowerCase()} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => remove(index)}
                    disabled={options.length <= MIN_OPTIONS}
                    aria-label={`Remove ${label.toLowerCase()}`}
                  >
                    ×
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {!fixed && (
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={add}
            disabled={options.length >= MAX_OPTIONS}
          >
            Add {noun.toLowerCase()}
          </Button>
        </div>
      )}
    </div>
  );
}

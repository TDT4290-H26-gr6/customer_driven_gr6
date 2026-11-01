import { useId } from "react";
import type { AuthoredContent } from "../types";
import styles from "./Editors.module.css";

type Scale = NonNullable<AuthoredContent["scale"]>;

type Props = {
  scale: Scale;
  onChange: (scale: Scale) => void;
};

const MIN = 0;
const MAX = 10;

/**
 * A self-rating scale: where it starts and ends, and either a label for each
 * end (the numbers in between speak for themselves) or one for every step.
 * The step the learner picks is their score, out of the top of the scale.
 */
export function LikertEditor({ scale, onChange }: Props) {
  const id = useId();
  const everyStep = Array.isArray(scale.labels);
  const steps = Array.from(
    { length: Math.max(0, scale.max - scale.min + 1) },
    (_, i) => scale.min + i,
  );

  function setBound(bound: "min" | "max", value: number) {
    const next = { ...scale, [bound]: value };
    if (everyStep) {
      const length = Math.max(0, next.max - next.min + 1);
      next.labels = Array.from({ length }, (_, i) => scale.labels?.[i] ?? "");
    }
    onChange(next);
  }

  function setMode(stepLabels: boolean) {
    onChange(
      stepLabels
        ? { min: scale.min, max: scale.max, labels: steps.map(() => "") }
        : { min: scale.min, max: scale.max, minLabel: "", maxLabel: "" },
    );
  }

  return (
    <div className={styles.likert}>
      <div className={styles.inlineFields}>
        <label className={styles.field}>
          <span className={styles.label}>Scale starts at</span>
          <input
            type="number"
            className={styles.number}
            min={MIN}
            max={MAX - 1}
            value={scale.min}
            onChange={(e) => setBound("min", Number(e.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Scale ends at</span>
          <input
            type="number"
            className={styles.number}
            min={MIN + 1}
            max={MAX}
            value={scale.max}
            onChange={(e) => setBound("max", Number(e.target.value))}
          />
        </label>
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>Labels</legend>
        <label className={styles.radio}>
          <input type="radio" name={id} checked={!everyStep} onChange={() => setMode(false)} />
          Label the two ends
        </label>
        <label className={styles.radio}>
          <input type="radio" name={id} checked={everyStep} onChange={() => setMode(true)} />
          Label every step
        </label>
      </fieldset>

      {everyStep ? (
        <ol className={styles.optionList}>
          {steps.map((step, i) => (
            <li key={step} className={styles.optionRow}>
              <span className={styles.position} aria-hidden="true">
                {step}
              </span>
              <input
                type="text"
                className={styles.optionText}
                value={scale.labels?.[i] ?? ""}
                onChange={(e) =>
                  onChange({
                    ...scale,
                    labels: steps.map((_, j) =>
                      j === i ? e.target.value : (scale.labels?.[j] ?? ""),
                    ),
                  })
                }
                aria-label={`Label for ${step}`}
                maxLength={500}
              />
            </li>
          ))}
        </ol>
      ) : (
        <div className={styles.inlineFields}>
          <label className={styles.field}>
            <span className={styles.label}>Label for {scale.min} (optional)</span>
            <input
              type="text"
              className={styles.optionText}
              value={scale.minLabel ?? ""}
              onChange={(e) => onChange({ ...scale, minLabel: e.target.value })}
              placeholder="e.g. Not at all confident"
              maxLength={500}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Label for {scale.max} (optional)</span>
            <input
              type="text"
              className={styles.optionText}
              value={scale.maxLabel ?? ""}
              onChange={(e) => onChange({ ...scale, maxLabel: e.target.value })}
              placeholder="e.g. Very confident"
              maxLength={500}
            />
          </label>
        </div>
      )}
    </div>
  );
}

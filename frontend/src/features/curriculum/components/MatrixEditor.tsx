import { Button } from "@/shared/components/Button";
import { nextOptionId, TRUE_FALSE_COLUMNS } from "../questionTypes";
import type { MatrixRow, Option, QuestionType } from "../types";
import { OptionsEditor } from "./OptionsEditor";
import styles from "./Editors.module.css";

const MIN_ROWS = 2;
const MAX_ROWS = 20;

type Props = {
  questionType: QuestionType;
  columns: Option[];
  rows: MatrixRow[];
  onChange: (columns: Option[], rows: MatrixRow[]) => void;
};

/**
 * The table of a matrix question (true/false statements, sorting into
 * categories, matching): its answer columns, and its rows, each with the
 * column that's right for it. A true/false matrix's columns are fixed. Ids
 * never change once made: learners' saved answers refer to the rows.
 */
export function MatrixEditor({ questionType, columns, rows, onChange }: Props) {
  const trueFalse = questionType === "true_false_matrix";
  const shownColumns = trueFalse ? TRUE_FALSE_COLUMNS : columns;
  const rowNoun = trueFalse ? "Statement" : "Item";
  const columnNoun = questionType === "classification_matrix" ? "Category" : "Answer";

  function setColumns(next: Option[]) {
    // A row whose answer was removed needs a new one.
    const ids = new Set(next.map((c) => c.id));
    onChange(
      next,
      rows.map((row) => (ids.has(row.correctColumnId) ? row : { ...row, correctColumnId: "" })),
    );
  }

  function setRow(index: number, changes: Partial<MatrixRow>) {
    onChange(
      columns,
      rows.map((row, i) => (i === index ? { ...row, ...changes } : row)),
    );
  }

  function move(index: number, by: -1 | 1) {
    const next = [...rows];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(columns, next);
  }

  return (
    <div className={styles.options}>
      {!trueFalse && (
        <div className={styles.options}>
          <span className={styles.subLabel}>
            {columnNoun === "Category" ? "Categories" : "Answers"} (the table&apos;s columns)
          </span>
          <OptionsEditor
            options={columns}
            correctIds={[]}
            mode="order"
            noun={columnNoun}
            onChange={(next) => setColumns(next)}
          />
        </div>
      )}

      <span className={styles.subLabel}>
        {trueFalse ? "Statements" : "Items"} (the table&apos;s rows), each with its right answer
      </span>
      <ol className={styles.optionList}>
        {rows.map((row, index) => {
          const label = `${rowNoun} ${index + 1}`;
          return (
            <li key={row.id} className={`${styles.optionRow} ${styles.matrixRow}`}>
              <span className={styles.position} aria-hidden="true">
                {index + 1}
              </span>
              <textarea
                className={`${styles.optionText} ${styles.rowText}`}
                rows={2}
                value={row.text}
                onChange={(e) => setRow(index, { text: e.target.value })}
                aria-label={`${label} text`}
                placeholder={label}
                maxLength={500}
              />
              <select
                className={styles.answerSelect}
                value={row.correctColumnId}
                onChange={(e) => setRow(index, { correctColumnId: e.target.value })}
                aria-label={`${label}: right answer`}
              >
                <option value="">Right answer…</option>
                {shownColumns.map((column, c) => (
                  <option key={column.id} value={column.id}>
                    {column.text.trim() || `${columnNoun} ${c + 1}`}
                  </option>
                ))}
              </select>
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
                  disabled={index === rows.length - 1}
                  aria-label={`Move ${label.toLowerCase()} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() =>
                    onChange(
                      columns,
                      rows.filter((_, i) => i !== index),
                    )
                  }
                  disabled={rows.length <= MIN_ROWS}
                  aria-label={`Remove ${label.toLowerCase()}`}
                >
                  ×
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            onChange(columns, [
              ...rows,
              {
                id: nextOptionId(rows),
                text: "",
                correctColumnId: trueFalse ? "true" : "",
              },
            ])
          }
          disabled={rows.length >= MAX_ROWS}
        >
          Add {rowNoun.toLowerCase()}
        </Button>
      </div>
    </div>
  );
}

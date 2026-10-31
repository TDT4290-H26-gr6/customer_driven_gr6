import { useMemo, useState } from "react";
import { shortTitle, sortQuestions, type SortKey, type SortState } from "../dropoff";
import type { DropoffQuestion } from "../types";
import styles from "./DropoffTable.module.css";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean; hint?: string }[] = [
  { key: "text", label: "Question" },
  { key: "section", label: "Section" },
  { key: "questionType", label: "Type" },
  {
    key: "viewedCount",
    label: "Viewed",
    numeric: true,
    hint: "Finished or abandoned runs that were shown this question",
  },
  {
    key: "answeredCount",
    label: "Answered",
    numeric: true,
    hint: "Of those, how many answered it",
  },
  {
    key: "droppedCount",
    label: "Stopped here",
    numeric: true,
    hint: "Abandoned runs where this was the last question shown, whether or not it was answered",
  },
  {
    key: "dropOffRate",
    label: "Stopped here (rate)",
    numeric: true,
    hint: "Stopped here ÷ viewed",
  },
];

/** Ranked table of questions, worst drop-off first; click a header to re-sort. */
export function DropoffTable({ questions }: { questions: DropoffQuestion[] }) {
  const [sort, setSort] = useState<SortState>(null);
  const rows = useMemo(() => sortQuestions(questions, sort), [questions, sort]);

  function toggle(key: SortKey, numeric: boolean) {
    setSort((current) =>
      current?.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: numeric ? "desc" : "asc" },
    );
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const active = sort?.key === col.key ? sort : null;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={col.numeric ? styles.numeric : undefined}
                  aria-sort={active ? (active.dir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    className={styles.sortButton}
                    title={col.hint}
                    onClick={() => toggle(col.key, Boolean(col.numeric))}
                  >
                    {col.label}
                    <span aria-hidden="true">
                      {active ? (active.dir === "asc" ? " ▲" : " ▼") : ""}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((q) => (
            <tr key={q.questionId}>
              <td title={q.text}>
                {shortTitle(q.text)}
                {q.lowSample && <span className={styles.badge}>low sample</span>}
              </td>
              <td>{q.section.name}</td>
              <td>{q.questionType}</td>
              <td className={styles.numeric}>{q.viewedCount}</td>
              <td className={styles.numeric}>{q.answeredCount}</td>
              <td className={styles.numeric}>{q.droppedCount}</td>
              <td className={styles.numeric}>{(q.dropOffRate * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

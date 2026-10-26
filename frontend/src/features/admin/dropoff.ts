import type { DropoffQuestion } from "./types";

const TITLE_MAX = 60;

/** The question prompt cut to one readable line for labels and tooltips. */
export function shortTitle(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > TITLE_MAX ? `${oneLine.slice(0, TITLE_MAX - 1)}…` : oneLine;
}

export type SortKey =
  | "text"
  | "section"
  | "questionType"
  | "viewedCount"
  | "answeredCount"
  | "droppedCount"
  | "dropOffRate";
export type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

function sortValue(q: DropoffQuestion, key: SortKey): string | number {
  return key === "section" ? q.section.name : q[key];
}

/**
 * `sort === null` is the default ranking: worst drop-off rate first, with
 * low-sample rows below the reliable ones. An explicit column sort is plain.
 */
export function sortQuestions(questions: DropoffQuestion[], sort: SortState): DropoffQuestion[] {
  const rows = [...questions];
  if (sort === null) {
    return rows.sort(
      (a, b) =>
        Number(a.lowSample) - Number(b.lowSample) ||
        b.dropOffRate - a.dropOffRate ||
        b.droppedCount - a.droppedCount,
    );
  }
  const factor = sort.dir === "asc" ? 1 : -1;
  return rows.sort((a, b) => {
    const left = sortValue(a, sort.key);
    const right = sortValue(b, sort.key);
    const cmp =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right));
    return cmp * factor;
  });
}

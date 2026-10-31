import type { AuthoredContent, CurriculumModule, MatrixRow, Option, QuestionType } from "./types";

/** Every question type the editor offers, in the order the type picker lists them. */
export const QUESTION_TYPE_INFO: { type: QuestionType; label: string; hint: string }[] = [
  {
    type: "likert",
    label: "Self-rating scale",
    hint: "The learner rates themselves on a scale. No right answer: a higher rating scores higher.",
  },
  {
    type: "single_choice",
    label: "Single choice",
    hint: "The learner picks one option. Exactly one is correct.",
  },
  {
    type: "multi_choice",
    label: "Multiple choice",
    hint: "The learner ticks every option that applies. Correct ticks score, wrong ticks count against.",
  },
  {
    type: "true_false",
    label: "True or false",
    hint: "The learner decides whether a statement is true.",
  },
  {
    type: "criteria_check",
    label: "Judge an example",
    hint: "The learner reads an example (a README, a plan …) and ticks every criterion it meets.",
  },
  {
    type: "ordering",
    label: "Put in order",
    hint: "The learner arranges the items in the right sequence. List them here in the correct order.",
  },
  {
    type: "true_false_matrix",
    label: "True or false: several statements",
    hint: "The learner marks each statement true or false, in a table. Each statement counts on its own.",
  },
  {
    type: "classification_matrix",
    label: "Sort into categories",
    hint: "The learner puts each item into one of your categories, in a table. Each item counts on its own.",
  },
  {
    type: "matching",
    label: "Match items",
    hint: "The learner matches each item to one of your answers, in a table. An answer can fit several items; one that fits none is a distractor.",
  },
];

/** The question types shown as a table: one row per statement or item, one column per answer. */
export const MATRIX_TYPES: QuestionType[] = [
  "true_false_matrix",
  "classification_matrix",
  "matching",
];

export const isMatrixType = (type: QuestionType) => MATRIX_TYPES.includes(type);

/** A true/false matrix's columns, always these (TRUE_FALSE_COLUMNS in the backend). */
export const TRUE_FALSE_COLUMNS: Option[] = [
  { id: "true", text: "True" },
  { id: "false", text: "False" },
];

export function questionTypeLabel(type: QuestionType): string {
  return QUESTION_TYPE_INFO.find((info) => info.type === type)?.label ?? type;
}

/** An id for a new option, unique among `existing` ("a", "b", … then "o27"). */
export function nextOptionId(existing: Option[]): string {
  const used = new Set(existing.map((o) => o.id));
  for (const letter of "abcdefghijklmnopqrstuvwxyz") if (!used.has(letter)) return letter;
  let n = existing.length;
  while (used.has(`o${n}`)) n++;
  return `o${n}`;
}

/** What a new question of this type starts with. */
export function emptyContent(type: QuestionType): AuthoredContent {
  switch (type) {
    case "likert":
      return { scale: { min: 1, max: 5, minLabel: "", maxLabel: "" } };
    case "true_false":
      return {
        options: [
          { id: "true", text: "True" },
          { id: "false", text: "False" },
        ],
        correctOptionIds: ["true"],
      };
    case "criteria_check":
      return { exhibit: "", options: twoOptions(), correctOptionIds: [] };
    case "ordering":
      return { options: twoOptions() };
    case "true_false_matrix":
      return { columns: TRUE_FALSE_COLUMNS, rows: twoRows("true") };
    case "classification_matrix":
    case "matching":
      return { columns: twoOptions(), rows: twoRows("") };
    default:
      return { options: twoOptions(), correctOptionIds: [] };
  }
}

function twoRows(correctColumnId: string): MatrixRow[] {
  return [
    { id: "a", text: "", correctColumnId },
    { id: "b", text: "", correctColumnId },
  ];
}

function twoOptions(): Option[] {
  return [
    { id: "a", text: "" },
    { id: "b", text: "" },
  ];
}

/**
 * Switching type keeps what still fits: the options when both types have
 * them (correct answers only where they still make sense), else the new
 * type's empty template.
 */
export function convertContent(content: AuthoredContent, to: QuestionType): AuthoredContent {
  const template = emptyContent(to);
  // Between the matrix types the rows carry over; their answers only where
  // the column still exists.
  if (isMatrixType(to)) {
    if (!content.rows?.length) return template;
    const columns = to === "true_false_matrix" ? TRUE_FALSE_COLUMNS : (content.columns ?? []);
    const ids = new Set(columns.map((c) => c.id));
    const rows = content.rows.map((row) => ({
      ...row,
      correctColumnId: ids.has(row.correctColumnId) ? row.correctColumnId : "",
    }));
    return { columns, rows };
  }
  if (to === "likert" || to === "true_false" || !content.options?.length) return template;
  const options = content.options;
  if (to === "ordering") return { options };
  const correct = (content.correctOptionIds ?? []).filter((id) => options.some((o) => o.id === id));
  return {
    ...template,
    options,
    correctOptionIds: to === "single_choice" ? correct.slice(0, 1) : correct,
  };
}

/** A module as pickers and lists show it: "A1 · Data management plans (level 1)". */
export function moduleLabel(sectionCode: string | null, module: CurriculumModule): string {
  const level = module.level !== null ? ` (level ${module.level})` : "";
  return `${sectionCode ? `${sectionCode} · ` : ""}${module.name}${level}`;
}

/** "1 question", "3 questions". */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** How strongly a journey covers a section, as the editor names it. */
export const COVERAGE_INFO: { level: "M" | "R" | "S"; label: string; hint: string }[] = [
  {
    level: "M",
    label: "Main",
    hint: "The journey is centred on it; assessing the journey asks about it.",
  },
  { level: "R", label: "Recommended", hint: "The journey covers it well." },
  { level: "S", label: "Supplementary", hint: "The journey touches on it." },
];

// Turns a question's own simple definition (as authored in the seed data) into
// the PIE item content that <pie-fixed-player> renders. Most question types
// use PIE's `multiple-choice` element; they differ only in radio-vs-checkbox,
// in how choices are built, and (criteria_check) in an example shown above
// the question. ordering and the three matrix types use a standalone PIE
// element of their own (NativeElementContent).
//
// The stored `content` is what the frontend feeds the player, and what the
// backend's assessment.service.ts reads back to score answers (choice `value`
// + `correct`). That stored shape is the contract between this package and the
// backend: change it on both sides together.

/**
 * The "I don't know" choice added to every question. Must match IDK_VALUE /
 * IDK_LABEL in backend/src/modules/assessment/assessment.scoring.ts (which
 * scores it as 0) and frontend/src/features/assessment/components/idkSession.ts.
 */
export const IDK_VALUE = "__idk__";
export const IDK_LABEL = "I don't know";

export type PieContent = {
  elements: Record<string, string>;
  models: unknown[];
  markup: string;
};

/**
 * A question rendered by its own standalone PIE custom element (not
 * <pie-fixed-player>), see frontend/src/features/assessment/components/
 * PieQuestionPlayer.tsx, which picks the element to mount by `questionType`
 * rather than by anything in `model` itself.
 */
export type NativeElementContent = {
  /** The custom element tag PieQuestionPlayer mounts, e.g. "aios-placement-ordering". */
  element: string;
  /** Set as the element's `.model` property, in that element's own shape. */
  model: Record<string, unknown>;
};

/** The authored shape of a question's content, before conversion. */
export type AuthoredContent = {
  /**
   * likert. Either just the ends are labelled (minLabel/maxLabel), or every
   * step has its own text (`labels`, one per step from min to max), as the
   * WP2 self-rating items do.
   */
  scale?: { min: number; max: number; minLabel?: string; maxLabel?: string; labels?: string[] };
  /** single_choice / multi_choice / true_false / criteria_check / ordering (the items) */
  options?: { id: string; text: string }[];
  correctOptionIds?: string[];
  /**
   * criteria_check: the example the learner judges (a README, a change log,
   * a sharing plan …), plain text, line breaks kept. The options are the
   * criteria, and the correct ones are those the example meets.
   */
  exhibit?: string;
  /** ordering: `options`' ids, in the correct sequence. */
  correctOrder?: string[];
  /**
   * true_false_matrix / classification_matrix / matching: a table with one
   * row per statement or item and one column per answer; the learner picks
   * one column in each row. A column no row needs is a distractor. A
   * true_false_matrix's columns are always True and False (TRUE_FALSE_COLUMNS),
   * whatever is given here.
   */
  columns?: { id: string; text: string }[];
  /** The matrix types: each row, and the id of the column that's right for it. */
  rows?: { id: string; text: string; correctColumnId: string }[];
};

export const QUESTION_TYPES = [
  "likert",
  "single_choice",
  "multi_choice",
  "true_false",
  "criteria_check",
  "ordering",
  "true_false_matrix",
  "classification_matrix",
  "matching",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * Plain text made safe to put between HTML tags: PIE renders prompts,
 * labels and headers as HTML, so text from the dataset or the curriculum
 * editor must never be able to add markup (a script, an `onerror`). Quotes
 * are left alone, so it isn't safe inside an attribute; nothing here puts
 * text in one.
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type PieChoice = { value: string; label: string; correct: boolean };

/**
 * Every question, of any type, gets an extra "I don't know" choice appended
 * last, so a learner never has to guess (see IDK_VALUE in assessment.scoring.ts).
 * It's a real PIE choice, so the player's own isComplete() already treats
 * picking it as answering the question; no frontend change needed.
 */
function multipleChoiceContent(
  /** HTML, already escaped (see escapeHtml), PIE renders it as markup. */
  promptHtml: string,
  choiceMode: "radio" | "checkbox",
  choices: PieChoice[],
): PieContent {
  const idkChoice: PieChoice = {
    value: IDK_VALUE,
    label: `<div>${escapeHtml(IDK_LABEL)}</div>`,
    correct: false,
  };
  return {
    elements: { "multiple-choice": "@pie-element/multiple-choice@latest" },
    models: [
      {
        id: "1",
        element: "multiple-choice",
        prompt: promptHtml,
        choiceMode,
        choices: [...choices, idkChoice],
      },
    ],
    markup: "<multiple-choice id='1'></multiple-choice>",
  };
}

function likertChoices(scale: NonNullable<AuthoredContent["scale"]>): PieChoice[] {
  const choices: PieChoice[] = [];
  for (let n = scale.min; n <= scale.max; n++) {
    // Either every step has its own text, or only the ends are labelled and
    // the numbers in between carry the meaning. Either way the value is the
    // number itself, that is the score.
    const own = scale.labels?.[n - scale.min];
    const end = n === scale.min ? scale.minLabel : n === scale.max ? scale.maxLabel : undefined;
    const text = own ?? (end ? `${n} - ${end}` : String(n));
    choices.push({ value: String(n), label: `<div>${escapeHtml(text)}</div>`, correct: false });
  }
  return choices;
}

/**
 * The prompt with the example to judge in a box under it. The box's class is
 * styled in globals.css (the player renders in the page's own DOM, so the
 * app's theme reaches it).
 */
function promptWithExhibit(prompt: string, exhibit: string): string {
  const lines = exhibit.split("\n").map(escapeHtml).join("<br>");
  return `<p>${escapeHtml(prompt)}</p><div class="aios-exhibit">${lines}</div>`;
}

function optionChoices(content: AuthoredContent): PieChoice[] {
  const correct = new Set(content.correctOptionIds ?? []);
  return (content.options ?? []).map((option) => ({
    value: option.id,
    label: `<div>${escapeHtml(option.text)}</div>`,
    correct: correct.has(option.id),
  }));
}

/**
 * Arrange-into-the-correct-sequence, via the standalone
 * @pie-element/placement-ordering custom element (not <pie-fixed-player> ,
 * see PieQuestionPlayer.tsx). `content.options` are the items to arrange;
 * `content.correctOrder` is their ids in the correct sequence, and must list
 * every option exactly once, this element has no concept of a "distractor"
 * item that isn't part of the answer.
 */
function orderingContent(prompt: string, content: AuthoredContent): NativeElementContent {
  const options = content.options ?? [];
  const correctOrder = content.correctOrder ?? [];
  if (options.length === 0) throw new Error("ordering question needs content.options");
  if (correctOrder.length === 0) throw new Error("ordering question needs content.correctOrder");
  const optionIds = new Set(options.map((o) => o.id));
  for (const id of correctOrder) {
    if (!optionIds.has(id)) {
      throw new Error(`ordering question's correctOrder references an unknown option id: ${id}`);
    }
  }
  if (correctOrder.length !== options.length) {
    throw new Error("ordering question's correctOrder must list every option exactly once");
  }

  return {
    element: "aios-placement-ordering",
    model: {
      id: "1",
      element: "aios-placement-ordering",
      prompt: `<p>${escapeHtml(prompt)}</p>`,
      choices: options.map((o) => ({ id: o.id, label: escapeHtml(o.text) })),
      correctResponse: correctOrder,
      orientation: "vertical",
      partialScoring: true,
    },
  };
}

/** A true_false_matrix's columns. */
export const TRUE_FALSE_COLUMNS = [
  { id: "true", text: "True" },
  { id: "false", text: "False" },
];

/**
 * The matrix types (true/false statements, classifying items into
 * categories, matching items to answers), via the standalone @pie-element/match
 * custom element: a table with a radio button in every cell. Each row's
 * `values` marks its correct column, which the backend scores against (the
 * element itself only reads ids, titles and headers). Every row also gets an
 * "I don't know" column, last, which scores that row 0, so a learner never
 * has to guess on a row.
 */
function matrixContent(
  questionType: string,
  prompt: string,
  content: AuthoredContent,
): NativeElementContent {
  const columns =
    questionType === "true_false_matrix" ? TRUE_FALSE_COLUMNS : (content.columns ?? []);
  const rows = content.rows ?? [];
  if (columns.length < 2) throw new Error(`${questionType} question needs at least 2 columns`);
  if (rows.length === 0) throw new Error(`${questionType} question needs content.rows`);
  const columnIds = new Set(columns.map((c) => c.id));
  for (const row of rows) {
    if (!columnIds.has(row.correctColumnId)) {
      throw new Error(`${questionType} row "${row.id}" has an unknown correctColumnId`);
    }
  }

  return {
    element: "aios-match",
    model: {
      id: "1",
      element: "aios-match",
      prompt: `<p>${escapeHtml(prompt)}</p>`,
      choiceMode: "radio",
      // The first header heads the row texts.
      headers: ["", ...columns.map((c) => escapeHtml(c.text)), escapeHtml(IDK_LABEL)],
      // Columns shown, the row texts' column included.
      layout: columns.length + 2,
      rows: rows.map((row) => ({
        id: row.id,
        title: escapeHtml(row.text),
        values: [...columns.map((c) => c.id === row.correctColumnId), false],
      })),
      partialScoring: true,
      lockChoiceOrder: true,
    },
  };
}

export function buildPieContent(
  questionType: string,
  prompt: string,
  content: AuthoredContent,
): PieContent | NativeElementContent {
  switch (questionType) {
    case "likert":
      if (!content.scale) throw new Error("likert question needs content.scale");
      return multipleChoiceContent(escapeHtml(prompt), "radio", likertChoices(content.scale));
    case "single_choice":
    case "true_false":
      return multipleChoiceContent(escapeHtml(prompt), "radio", optionChoices(content));
    case "multi_choice":
      return multipleChoiceContent(escapeHtml(prompt), "checkbox", optionChoices(content));
    // "Judge an example against criteria": tick every criterion the example
    // meets. Scored exactly like multi_choice, each criterion found counts,
    // each one ticked that the example doesn't meet counts against.
    case "criteria_check":
      if (!content.exhibit?.trim())
        throw new Error("criteria_check question needs content.exhibit");
      return multipleChoiceContent(
        promptWithExhibit(prompt, content.exhibit),
        "checkbox",
        optionChoices(content),
      );
    case "ordering":
      return orderingContent(prompt, content);
    case "true_false_matrix":
    case "classification_matrix":
    case "matching":
      return matrixContent(questionType, prompt, content);
    default:
      throw new Error(`Unknown question type: ${questionType}`);
  }
}

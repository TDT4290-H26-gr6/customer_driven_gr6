// Turns a question's own simple definition (as authored in the seed data) into
// the PIE item content that <pie-fixed-player> renders. Every question type
// uses PIE's `multiple-choice` element, which this app already renders and
// scores; they differ only in radio-vs-checkbox, in how choices are built,
// and (criteria_check) in an example shown above the question.
//
// The stored `content` is what the frontend feeds the player, and what
// assessment.service.ts reads back to score answers (choice `value` + `correct`).

import { IDK_LABEL, IDK_VALUE } from "./assessment.scoring";

export type PieContent = {
  elements: Record<string, string>;
  models: unknown[];
  markup: string;
};

/** The authored shape of a question's content, before conversion. */
export type AuthoredContent = {
  /**
   * likert. Either just the ends are labelled (minLabel/maxLabel), or every
   * step has its own text (`labels`, one per step from min to max) — as the
   * WP2 self-rating items do.
   */
  scale?: { min: number; max: number; minLabel?: string; maxLabel?: string; labels?: string[] };
  /** single_choice / multi_choice / true_false / criteria_check */
  options?: { id: string; text: string }[];
  correctOptionIds?: string[];
  /**
   * criteria_check: the example the learner judges (a README, a change log,
   * a sharing plan …) — plain text, line breaks kept. The options are the
   * criteria, and the correct ones are those the example meets.
   */
  exhibit?: string;
};

export const QUESTION_TYPES = [
  "likert",
  "single_choice",
  "multi_choice",
  "true_false",
  "criteria_check",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Question types whose on-screen choice order is meaningful and must never be shuffled. */
export const ORDERED_QUESTION_TYPES: readonly string[] = ["likert", "true_false"];

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type PieChoice = { value: string; label: string; correct: boolean };

/**
 * Every question — of any type — gets an extra "I don't know" choice appended
 * last, so a learner never has to guess (see IDK_VALUE in assessment.scoring.ts).
 * It's a real PIE choice, so the player's own isComplete() already treats
 * picking it as answering the question; no frontend change needed.
 */
function multipleChoiceContent(
  prompt: string,
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
      { id: "1", element: "multiple-choice", prompt, choiceMode, choices: [...choices, idkChoice] },
    ],
    markup: "<multiple-choice id='1'></multiple-choice>",
  };
}

function likertChoices(scale: NonNullable<AuthoredContent["scale"]>): PieChoice[] {
  const choices: PieChoice[] = [];
  for (let n = scale.min; n <= scale.max; n++) {
    // Either every step has its own text, or only the ends are labelled and
    // the numbers in between carry the meaning. Either way the value is the
    // number itself — that is the score.
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

export function buildPieContent(
  questionType: string,
  prompt: string,
  content: AuthoredContent,
): PieContent {
  switch (questionType) {
    case "likert":
      if (!content.scale) throw new Error("likert question needs content.scale");
      return multipleChoiceContent(prompt, "radio", likertChoices(content.scale));
    case "single_choice":
    case "true_false":
      return multipleChoiceContent(prompt, "radio", optionChoices(content));
    case "multi_choice":
      return multipleChoiceContent(prompt, "checkbox", optionChoices(content));
    // "Judge an example against criteria": tick every criterion the example
    // meets. Scored exactly like multi_choice — each criterion found counts,
    // each one ticked that the example doesn't meet counts against.
    case "criteria_check":
      if (!content.exhibit?.trim())
        throw new Error("criteria_check question needs content.exhibit");
      return multipleChoiceContent(
        promptWithExhibit(prompt, content.exhibit),
        "checkbox",
        optionChoices(content),
      );
    default:
      throw new Error(`Unknown question type: ${questionType}`);
  }
}

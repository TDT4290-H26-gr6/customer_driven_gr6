// Turns a question's own simple definition (as authored in the seed data) into
// the PIE item content that <pie-fixed-player> renders. All four question
// types use PIE's `multiple-choice` element, which this app already renders
// and scores; they differ only in radio-vs-checkbox and in how choices are built.
//
// The stored `content` is what the frontend feeds the player, and what
// assessment.service.ts reads back to score answers (choice `value` + `correct`).

export type PieContent = {
  elements: Record<string, string>;
  models: unknown[];
  markup: string;
};

/** The authored shape of a question's content, before conversion. */
export type AuthoredContent = {
  /** likert */
  scale?: { min: number; max: number; minLabel?: string; maxLabel?: string };
  /** single_choice / multi_choice / true_false */
  options?: { id: string; text: string }[];
  correctOptionIds?: string[];
};

export const QUESTION_TYPES = ["likert", "single_choice", "multi_choice", "true_false"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Question types whose on-screen choice order is meaningful and must never be shuffled. */
export const ORDERED_QUESTION_TYPES: readonly string[] = ["likert", "true_false"];

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type PieChoice = { value: string; label: string; correct: boolean };

function multipleChoiceContent(
  prompt: string,
  choiceMode: "radio" | "checkbox",
  choices: PieChoice[],
): PieContent {
  return {
    elements: { "multiple-choice": "@pie-element/multiple-choice@latest" },
    models: [{ id: "1", element: "multiple-choice", prompt, choiceMode, choices }],
    markup: "<multiple-choice id='1'></multiple-choice>",
  };
}

function likertChoices(scale: NonNullable<AuthoredContent["scale"]>): PieChoice[] {
  const choices: PieChoice[] = [];
  for (let n = scale.min; n <= scale.max; n++) {
    // Only the ends are labelled by the author; the numbers in between carry
    // the meaning. The value is the number itself — that is the score.
    const end = n === scale.min ? scale.minLabel : n === scale.max ? scale.maxLabel : undefined;
    const text = end ? `${n} — ${end}` : String(n);
    choices.push({ value: String(n), label: `<div>${escapeHtml(text)}</div>`, correct: false });
  }
  return choices;
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
    default:
      throw new Error(`Unknown question type: ${questionType}`);
  }
}

import type { AuthoredContent, CurriculumModule, Option, QuestionType } from "./types";

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
    default:
      return { options: twoOptions(), correctOptionIds: [] };
  }
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

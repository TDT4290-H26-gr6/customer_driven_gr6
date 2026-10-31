import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPieContent, type AuthoredContent } from "./assessment.pie";
import { withoutAnswers } from "./assessment.redact";

describe("withoutAnswers", () => {
  it("drops which choices are right, keeping what the player shows and records", () => {
    const content = {
      markup: "<multiple-choice id='1'></multiple-choice>",
      elements: { "multiple-choice": "@pie-element/multiple-choice@latest" },
      models: [
        {
          id: "1",
          element: "multiple-choice",
          choiceMode: "checkbox",
          prompt: "Pick",
          choices: [
            { label: "<div>A</div>", value: "a", correct: true },
            { label: "<div>B</div>", value: "b", correct: false },
            { label: "<div>I don't know</div>", value: "__idk__", correct: false },
          ],
        },
      ],
    };
    expect(withoutAnswers(content)).toEqual({
      ...content,
      models: [
        {
          ...content.models[0],
          choices: [
            { label: "<div>A</div>", value: "a" },
            { label: "<div>B</div>", value: "b" },
            { label: "<div>I don't know</div>", value: "__idk__" },
          ],
        },
      ],
    });
  });

  it("drops an ordering question's correct sequence, keeping its items", () => {
    const model = {
      id: "1",
      element: "aios-placement-ordering",
      prompt: "<p>Order</p>",
      choices: [
        { id: "b", label: "Second" },
        { id: "a", label: "First" },
      ],
      orientation: "vertical",
      partialScoring: true,
    };
    expect(
      withoutAnswers({
        element: "aios-placement-ordering",
        model: { ...model, correctResponse: ["a", "b"] },
      }),
    ).toEqual({ element: "aios-placement-ordering", model });
  });

  it("drops each matrix row's right column, keeping the rows and columns", () => {
    const content = {
      element: "aios-match",
      model: {
        id: "1",
        element: "aios-match",
        choiceMode: "radio",
        headers: ["", "True", "False", "I don't know"],
        layout: 4,
        rows: [{ id: "s1", title: "A statement", values: [true, false, false] }],
      },
    };
    expect(withoutAnswers(content)).toEqual({
      ...content,
      model: { ...content.model, rows: [{ id: "s1", title: "A statement" }] },
    });
  });

  it("drops the answers and after-answer texts any other PIE model could carry", () => {
    const redacted = withoutAnswers({
      models: [
        {
          id: "1",
          element: "drag-in-the-blank",
          markup: "{{0}}",
          correctResponse: { "0": "a" },
          alternateResponses: { "0": ["b"] },
          rationale: "Because",
          feedback: { correct: { type: "custom" } },
          teacherInstructions: "The answer is a",
        },
      ],
    });
    expect(redacted).toEqual({
      models: [{ id: "1", element: "drag-in-the-blank", markup: "{{0}}" }],
    });
  });

  it("leaves content that isn't a question item as it is", () => {
    expect(withoutAnswers(null)).toBeNull();
    expect(withoutAnswers({})).toEqual({});
    expect(withoutAnswers({ models: ["odd"] })).toEqual({ models: ["odd"] });
  });

  it("doesn't change the stored content it's given", () => {
    const content = { element: "aios-match", model: { rows: [{ id: "s1", values: [true] }] } };
    withoutAnswers(content);
    expect(content.model.rows[0].values).toEqual([true]);
  });
});

/** Every key anywhere in `value`. */
function keysIn(value: unknown): Set<string> {
  const keys = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [key, child] of Object.entries(v)) {
        keys.add(key);
        walk(child);
      }
    }
  };
  walk(value);
  return keys;
}

describe("withoutAnswers on every WP2 question", () => {
  const dataset = JSON.parse(
    readFileSync(
      path.resolve(__dirname, "../../../../database/src/seed/data/aios_wp2_seed.json"),
      "utf8",
    ),
  ) as Record<string, unknown>;
  const questions = dataset["aios.assessment.question"] as {
    id: string;
    questionType: string;
    prompt: string;
    content: AuthoredContent;
  }[];

  it.each(questions.map((q) => [q.id, q] as const))(
    "%s reaches the browser without its answer",
    (_id, q) => {
      const built = buildPieContent(q.questionType, q.prompt, q.content);
      const keys = keysIn(withoutAnswers(built as never));
      for (const key of ["correct", "correctResponse", "values", "alternateResponses"]) {
        expect(keys).not.toContain(key);
      }
    },
  );
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPieContent, type AuthoredContent } from "./assessment.pie";
import { withoutAnswers } from "./assessment.redact";

describe("withoutAnswers", () => {
  it("sends multiple choice only what the player shows and records", () => {
    const content = {
      markup: "<multiple-choice id='1'></multiple-choice>",
      elements: { "multiple-choice": "@pie-element/multiple-choice@latest" },
      models: [
        {
          id: "1",
          element: "multiple-choice",
          choiceMode: "checkbox",
          prompt: "Pick",
          rationale: "Because a",
          choices: [
            { label: "<div>A</div>", value: "a", correct: true, rationale: "Right", feedback: {} },
            { label: "<div>B</div>", value: "b", correct: false },
            { label: "<div>I don't know</div>", value: "__idk__", correct: false },
          ],
        },
      ],
    };
    expect(withoutAnswers(content)).toEqual({
      markup: content.markup,
      elements: content.elements,
      models: [
        {
          id: "1",
          element: "multiple-choice",
          choiceMode: "checkbox",
          prompt: "Pick",
          choices: [
            { label: "<div>A</div>", value: "a" },
            { label: "<div>B</div>", value: "b" },
            { label: "<div>I don't know</div>", value: "__idk__" },
          ],
        },
      ],
    });
  });

  it("sends an ordering question its items, not the correct sequence", () => {
    const model = {
      id: "1",
      element: "aios-placement-ordering",
      prompt: "<p>Order</p>",
      choices: [
        { id: "b", label: "Second" },
        { id: "a", label: "First" },
      ],
      orientation: "vertical",
    };
    expect(
      withoutAnswers({
        element: "aios-placement-ordering",
        model: { ...model, correctResponse: ["a", "b"], partialScoring: true },
      }),
    ).toEqual({ element: "aios-placement-ordering", model });
  });

  it("sends a matrix its rows and columns, not each row's right column", () => {
    const model = {
      id: "1",
      element: "aios-match",
      prompt: "<p>True or false?</p>",
      choiceMode: "radio",
      headers: ["", "True", "False", "I don't know"],
      layout: 4,
      lockChoiceOrder: true,
    };
    expect(
      withoutAnswers({
        element: "aios-match",
        model: {
          ...model,
          partialScoring: true,
          rows: [{ id: "s1", title: "A statement", values: [true, false, false], feedback: "x" }],
        },
      }),
    ).toEqual({
      element: "aios-match",
      model: { ...model, rows: [{ id: "s1", title: "A statement" }] },
    });
  });

  it("leaves out any field it doesn't know, so a new answer field stays on the server", () => {
    const redacted = withoutAnswers({
      models: [{ id: "1", element: "multiple-choice", choices: [], answerKey: ["a"] }],
      solution: "a",
    });
    expect(redacted).toEqual({ models: [{ id: "1", element: "multiple-choice", choices: [] }] });
  });

  it("sends an element it doesn't know nothing but its id", () => {
    const redacted = withoutAnswers({
      models: [
        { id: "1", element: "drag-in-the-blank", markup: "{{0}}", correctResponse: { "0": "a" } },
      ],
    });
    expect(redacted).toEqual({ models: [{ id: "1", element: "drag-in-the-blank" }] });
  });

  it("leaves content that isn't a question item empty", () => {
    expect(withoutAnswers(null)).toBeNull();
    expect(withoutAnswers({})).toEqual({});
    expect(withoutAnswers({ answer: "a" })).toEqual({});
    expect(withoutAnswers({ models: ["odd"] })).toEqual({ models: [{}] });
  });

  it("doesn't change the stored content it's given", () => {
    const content = { element: "aios-match", model: { rows: [{ id: "s1", values: [true] }] } };
    withoutAnswers(content);
    expect(content.model.rows[0].values).toEqual([true]);
  });
});

type DatasetQuestion = {
  id: string;
  questionType: string;
  prompt: string;
  content: AuthoredContent;
};

/** The same question with a different right answer (a self-rating scale has none). */
function withOtherAnswer(q: DatasetQuestion): AuthoredContent {
  const c = q.content;
  const ids = (c.options ?? []).map((o) => o.id);
  if (c.correctOptionIds) {
    const wrong = ids.find((id) => !c.correctOptionIds!.includes(id))!;
    return { ...c, correctOptionIds: [wrong] };
  }
  if (c.correctOrder) return { ...c, correctOrder: [...c.correctOrder].reverse() };
  if (c.rows) {
    const columns =
      q.questionType === "true_false_matrix" ? ["true", "false"] : c.columns!.map((x) => x.id);
    return {
      ...c,
      rows: c.rows.map((r) => ({
        ...r,
        correctColumnId: columns.find((id) => id !== r.correctColumnId)!,
      })),
    };
  }
  return c;
}

describe("withoutAnswers on every WP2 question", () => {
  const dataset = JSON.parse(
    readFileSync(
      path.resolve(__dirname, "../../../../database/src/seed/data/aios_wp2_seed.json"),
      "utf8",
    ),
  ) as Record<string, unknown>;
  const questions = (dataset["aios.assessment.question"] as DatasetQuestion[]).filter(
    (q) => q.questionType !== "likert",
  );

  // Built with another right answer, the stored question differs; what a
  // learner gets must not, or something in it gives the answer away.
  it.each(questions.map((q) => [q.id, q] as const))(
    "%s reaches the browser the same whatever its right answer is",
    (_id, q) => {
      const build = (content: AuthoredContent) =>
        buildPieContent(q.questionType, q.prompt, content) as never;
      const stored = build(q.content);
      const otherStored = build(withOtherAnswer(q));

      expect(otherStored).not.toEqual(stored);
      expect(withoutAnswers(otherStored)).toEqual(withoutAnswers(stored));
    },
  );
});

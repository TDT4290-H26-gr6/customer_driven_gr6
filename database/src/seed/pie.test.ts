import { describe, expect, it } from "vitest";
import { buildPieContent, IDK_VALUE } from "./pie";

type Choice = { value: string; correct: boolean };
function choicesOf(content: ReturnType<typeof buildPieContent>): Choice[] {
  return (content.models[0] as { choices: Choice[] }).choices;
}

describe("buildPieContent: every question type gets an 'I don't know' choice", () => {
  it("appends it last, never marked correct, for likert", () => {
    const content = buildPieContent("likert", "How confident are you?", {
      scale: { min: 1, max: 3, minLabel: "Not at all", maxLabel: "Very" },
    });
    const choices = choicesOf(content);
    expect(choices.at(-1)).toMatchObject({ value: IDK_VALUE, correct: false });
    expect(choices).toHaveLength(4); // 1, 2, 3, then IDK
  });

  it("appends it last for single_choice, alongside the authored options", () => {
    const content = buildPieContent("single_choice", "Pick one", {
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      correctOptionIds: ["a"],
    });
    const choices = choicesOf(content);
    expect(choices.map((c) => c.value)).toEqual(["a", "b", IDK_VALUE]);
    expect(choices.at(-1)?.correct).toBe(false);
  });

  it("appends it last for true_false", () => {
    const content = buildPieContent("true_false", "Is this true?", {
      options: [
        { id: "true", text: "True" },
        { id: "false", text: "False" },
      ],
      correctOptionIds: ["true"],
    });
    expect(choicesOf(content).map((c) => c.value)).toEqual(["true", "false", IDK_VALUE]);
  });

  it("appends it last for multi_choice, as an unchecked checkbox choice", () => {
    const content = buildPieContent("multi_choice", "Pick all that apply", {
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      correctOptionIds: ["a", "b"],
    });
    expect(content.models[0]).toMatchObject({ choiceMode: "checkbox" });
    expect(choicesOf(content).map((c) => c.value)).toEqual(["a", "b", IDK_VALUE]);
  });
});

describe("buildPieContent: likert labels", () => {
  type LabelledChoice = Choice & { label: string };
  const labelled = (content: ReturnType<typeof buildPieContent>) =>
    choicesOf(content) as LabelledChoice[];

  it("labels only the ends when that's all the author gave", () => {
    const content = buildPieContent("likert", "How confident?", {
      scale: { min: 1, max: 3, minLabel: "Not at all", maxLabel: "Very" },
    });
    expect(labelled(content).map((c) => c.label)).toEqual([
      "<div>1 - Not at all</div>",
      "<div>2</div>",
      "<div>3 - Very</div>",
      expect.any(String), // "I don't know"
    ]);
  });

  it("gives every step its own text when labels are authored, keeping the number as the value", () => {
    const content = buildPieContent("likert", "How comfortable?", {
      scale: { min: 1, max: 3, labels: ["Not at all", "Somewhat", "Very"] },
    });
    const choices = labelled(content);
    expect(choices.slice(0, 3).map((c) => [c.value, c.label])).toEqual([
      ["1", "<div>Not at all</div>"],
      ["2", "<div>Somewhat</div>"],
      ["3", "<div>Very</div>"],
    ]);
  });
});

describe("buildPieContent: criteria_check", () => {
  const content = {
    exhibit: "README.md\nLicence: CC BY 4.0 <open>",
    options: [
      { id: "a", text: "States a licence" },
      { id: "b", text: "Gives a persistent identifier" },
    ],
    correctOptionIds: ["a"],
  };

  it("shows the example in its own box under the prompt, line breaks kept and escaped", () => {
    const model = buildPieContent("criteria_check", "Which criteria does it meet?", content)
      .models[0] as { prompt: string; choiceMode: string };

    expect(model.prompt).toBe(
      '<p>Which criteria does it meet?</p><div class="aios-exhibit">README.md<br>Licence: CC BY 4.0 &lt;open&gt;</div>',
    );
    expect(model.choiceMode).toBe("checkbox");
  });

  it("marks the criteria the example meets as correct, plus 'I don't know' last", () => {
    const choices = choicesOf(buildPieContent("criteria_check", "Which?", content));
    expect(choices.map((c) => [c.value, c.correct])).toEqual([
      ["a", true],
      ["b", false],
      [IDK_VALUE, false],
    ]);
  });

  it("refuses an item without an example", () => {
    expect(() => buildPieContent("criteria_check", "Which?", { ...content, exhibit: " " })).toThrow(
      /needs content.exhibit/,
    );
  });
});

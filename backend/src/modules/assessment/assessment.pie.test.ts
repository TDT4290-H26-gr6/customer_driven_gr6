import { describe, expect, it } from "vitest";
import { buildPieContent } from "./assessment.pie";
import { IDK_VALUE } from "./assessment.scoring";

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

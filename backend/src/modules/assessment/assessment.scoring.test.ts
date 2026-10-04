import { describe, expect, it } from "vitest";
import {
  extractDragAndDropBlanks,
  extractMultipleChoiceValues,
  IDK_VALUE,
  scoreDragAndDrop,
  scoreLikert,
  scoreMultipleChoice,
} from "./assessment.scoring";

describe("scoreMultipleChoice", () => {
  const choices = [
    { value: "0", correct: true },
    { value: "1", correct: false },
    { value: "2", correct: false },
  ];

  it("radio: scores 1/1 when the correct choice is picked", () => {
    expect(scoreMultipleChoice(choices, "radio", ["0"])).toEqual({ score: 1, maxScore: 1 });
  });

  it("radio: scores 0/1 when a wrong choice is picked", () => {
    expect(scoreMultipleChoice(choices, "radio", ["1"])).toEqual({ score: 0, maxScore: 1 });
  });

  it("radio: scores 0/1 when nothing is picked", () => {
    expect(scoreMultipleChoice(choices, "radio", [])).toEqual({ score: 0, maxScore: 1 });
  });

  const checkboxChoices = [
    { value: "0", correct: true },
    { value: "1", correct: true },
    { value: "2", correct: false },
    { value: "3", correct: false },
    { value: IDK_VALUE, correct: false },
  ];

  it("checkbox: scores 1/1 when every correct choice is picked and nothing else", () => {
    expect(scoreMultipleChoice(checkboxChoices, "checkbox", ["0", "1"])).toEqual({
      score: 1,
      maxScore: 1,
    });
  });

  it("checkbox: +1/alternatives per alternative handled right, -1/alternatives per one handled wrong", () => {
    // "0" picked (right), "1" missed (wrong), "2" unpicked (right), "3" unpicked (right)
    expect(scoreMultipleChoice(checkboxChoices, "checkbox", ["0"])).toEqual({
      score: 0.5, // (3 - 1) / 4
      maxScore: 1,
    });
    // "0" picked (right), "1" missed (wrong), "2" picked (wrong), "3" unpicked (right)
    expect(scoreMultipleChoice(checkboxChoices, "checkbox", ["0", "2"])).toEqual({
      score: 0, // (2 - 2) / 4
      maxScore: 1,
    });
  });

  it("checkbox: never scores below 0, even when every pick is wrong", () => {
    expect(scoreMultipleChoice(checkboxChoices, "checkbox", ["2", "3"])).toEqual({
      score: 0,
      maxScore: 1,
    });
  });

  it("checkbox: doesn't count 'I don't know' as an alternative", () => {
    // With IDK counted it would be 5 alternatives: (4 - 1) / 5 = 0.6.
    expect(scoreMultipleChoice(checkboxChoices, "checkbox", ["0", "1", "2"])).toEqual({
      score: 0.5, // (3 - 1) / 4
      maxScore: 1,
    });
  });
});

describe("scoreDragAndDrop", () => {
  const correctResponse = { "0": "a", "1": "b", "2": "c", "3": "d" };

  it("scores 1/1 when every blank is filled correctly", () => {
    expect(scoreDragAndDrop(correctResponse, { "0": "a", "1": "b", "2": "c", "3": "d" })).toEqual({
      score: 1,
      maxScore: 1,
    });
  });

  it("+1/blanks per correct blank, -1/blanks per incorrect blank", () => {
    expect(
      scoreDragAndDrop(correctResponse, { "0": "a", "1": "wrong", "2": "c", "3": "d" }),
    ).toEqual({
      score: 0.5, // (3 - 1) / 4
      maxScore: 1,
    });
  });

  it("a blank left empty (undefined) contributes nothing either way", () => {
    expect(
      scoreDragAndDrop(correctResponse, { "0": "a", "1": undefined, "2": "c", "3": undefined }),
    ).toEqual({
      score: 0.5, // 2 / 4
      maxScore: 1,
    });
  });

  it("never scores below 0, even when every blank is wrong", () => {
    expect(scoreDragAndDrop(correctResponse, { "0": "x", "1": "y", "2": "z", "3": "w" })).toEqual({
      score: 0,
      maxScore: 1,
    });
  });
});

describe("extractMultipleChoiceValues", () => {
  it("reads the array value from the matching model's session data", () => {
    const session = { id: "", data: [{ id: "1", value: ["0", "2"] }] };
    expect(extractMultipleChoiceValues(session, "1")).toEqual(["0", "2"]);
  });

  it("wraps a bare string value into an array", () => {
    const session = { id: "", data: [{ id: "1", value: "0" }] };
    expect(extractMultipleChoiceValues(session, "1")).toEqual(["0"]);
  });

  it("falls back to the first data entry when the modelId isn't found", () => {
    const session = { id: "", data: [{ id: "other-id", value: ["0"] }] };
    expect(extractMultipleChoiceValues(session, "1")).toEqual(["0"]);
  });

  it("returns an empty array for a missing or malformed session", () => {
    expect(extractMultipleChoiceValues(undefined, "1")).toEqual([]);
    expect(extractMultipleChoiceValues({}, "1")).toEqual([]);
    expect(extractMultipleChoiceValues({ data: [] }, "1")).toEqual([]);
    expect(extractMultipleChoiceValues({ data: "not-an-array" }, "1")).toEqual([]);
    expect(extractMultipleChoiceValues({ data: [null, 42] }, "1")).toEqual([]);
  });

  it("drops non-string entries from the client-sent value", () => {
    const session = { id: "", data: [{ id: "1", value: ["0", 1, { x: 1 }, null] }] };
    expect(extractMultipleChoiceValues(session, "1")).toEqual(["0"]);
  });
});

describe("extractDragAndDropBlanks", () => {
  it("reads the blank->choice map from the matching model's session data", () => {
    const session = { id: "", data: [{ id: "1", value: { "0": "a", "1": "b" } }] };
    expect(extractDragAndDropBlanks(session, "1")).toEqual({ "0": "a", "1": "b" });
  });

  it("takes the first element when a blank's value is an array", () => {
    const session = { id: "", data: [{ id: "1", value: { "0": ["a", "extra"] } }] };
    expect(extractDragAndDropBlanks(session, "1")).toEqual({ "0": "a" });
  });

  it("returns an empty object for a missing session", () => {
    expect(extractDragAndDropBlanks(undefined, "1")).toEqual({});
  });

  it("returns an empty object when the value isn't a blank->choice map", () => {
    expect(extractDragAndDropBlanks({ data: [{ id: "1", value: "abc" }] }, "1")).toEqual({});
    expect(extractDragAndDropBlanks({ data: [{ id: "1", value: ["a"] }] }, "1")).toEqual({});
  });

  it("treats a non-string blank as empty", () => {
    const session = { id: "", data: [{ id: "1", value: { "0": 5, "1": { x: 1 }, "2": "c" } }] };
    expect(extractDragAndDropBlanks(session, "1")).toEqual({
      "0": undefined,
      "1": undefined,
      "2": "c",
    });
  });
});

describe("scoreLikert", () => {
  const scale = ["1", "2", "3", "4", "5"];

  it("scores the picked scale value divided by the top of the scale, out of 1", () => {
    expect(scoreLikert(scale, ["4"])).toEqual({ score: 0.8, maxScore: 1 });
    expect(scoreLikert(scale, ["5"])).toEqual({ score: 1, maxScore: 1 });
  });

  it("scores 0 when nothing is picked", () => {
    expect(scoreLikert(scale, [])).toEqual({ score: 0, maxScore: 1 });
  });

  it("scores 0 for a value that isn't on the scale, instead of inflating the score", () => {
    expect(scoreLikert(scale, ["1000"])).toEqual({ score: 0, maxScore: 1 });
    expect(scoreLikert(scale, ["-3"])).toEqual({ score: 0, maxScore: 1 });
    expect(scoreLikert(scale, ["abc"])).toEqual({ score: 0, maxScore: 1 });
  });
});

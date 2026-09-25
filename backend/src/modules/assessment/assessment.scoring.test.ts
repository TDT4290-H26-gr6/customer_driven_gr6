import { describe, expect, it } from "vitest";
import {
  extractDragAndDropBlanks,
  extractMultipleChoiceValues,
  scoreDragAndDrop,
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
  ];

  it("checkbox: scores maxScore/maxScore when every correct choice is picked and nothing else", () => {
    expect(scoreMultipleChoice(checkboxChoices, "checkbox", ["0", "1"])).toEqual({
      score: 2,
      maxScore: 2,
    });
  });

  it("checkbox: +1 per correct pick, -1 per incorrect pick", () => {
    expect(scoreMultipleChoice(checkboxChoices, "checkbox", ["0", "2"])).toEqual({
      score: 0, // +1 (correct "0") - 1 (incorrect "2")
      maxScore: 2,
    });
  });

  it("checkbox: never scores below 0, even when every pick is wrong", () => {
    expect(scoreMultipleChoice(checkboxChoices, "checkbox", ["2", "3"])).toEqual({
      score: 0,
      maxScore: 2,
    });
  });

  it("checkbox: unselected choices never contribute, correct or not", () => {
    expect(scoreMultipleChoice(checkboxChoices, "checkbox", [])).toEqual({
      score: 0,
      maxScore: 2,
    });
  });
});

describe("scoreDragAndDrop", () => {
  const correctResponse = { "0": "a", "1": "b", "2": "c" };

  it("scores maxScore/maxScore when every blank is filled correctly", () => {
    expect(scoreDragAndDrop(correctResponse, { "0": "a", "1": "b", "2": "c" })).toEqual({
      score: 3,
      maxScore: 3,
    });
  });

  it("+1 per correct blank, -1 per incorrect blank", () => {
    expect(scoreDragAndDrop(correctResponse, { "0": "a", "1": "wrong", "2": "c" })).toEqual({
      score: 1, // +1 +1 -1
      maxScore: 3,
    });
  });

  it("a blank left empty (undefined) contributes nothing either way", () => {
    expect(scoreDragAndDrop(correctResponse, { "0": "a", "1": undefined, "2": "c" })).toEqual({
      score: 2,
      maxScore: 3,
    });
  });

  it("never scores below 0, even when every blank is wrong", () => {
    expect(scoreDragAndDrop(correctResponse, { "0": "x", "1": "y", "2": "z" })).toEqual({
      score: 0,
      maxScore: 3,
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
});

import { describe, expect, it } from "vitest";
import {
  extractDragAndDropBlanks,
  extractMatrixAnswers,
  extractMultipleChoiceValues,
  extractOrderingValues,
  IDK_VALUE,
  scoreDragAndDrop,
  scoreLikert,
  scoreMatrix,
  scoreMultipleChoice,
  scoreOrdering,
} from "./assessment.scoring";

describe("scoreMatrix", () => {
  // Columns: True, False, I don't know.
  const rows = [
    { id: "s1", correctColumn: 0 },
    { id: "s2", correctColumn: 1 },
    { id: "s3", correctColumn: 0 },
    { id: "s4", correctColumn: 1 },
  ];

  it("is the share of rows answered with their correct column", () => {
    expect(
      scoreMatrix(rows, {
        s1: [true, false, false],
        s2: [false, true, false],
        s3: [true, false, false],
        s4: [false, true, false],
      }),
    ).toEqual({ score: 1, maxScore: 1 });
    expect(
      scoreMatrix(rows, {
        s1: [true, false, false],
        s2: [true, false, false],
        s3: [true, false, false],
        s4: [true, false, false],
      }).score,
    ).toBe(0.5);
  });

  it('counts a row marked "I don\'t know", left empty or missing as wrong', () => {
    expect(
      scoreMatrix(rows, {
        s1: [true, false, false],
        s2: [false, false, true],
        s3: [false, false, false],
      }).score,
    ).toBe(0.25);
  });

  it("doesn't credit a row with more than one column selected", () => {
    expect(scoreMatrix([rows[0]], { s1: [true, true, false] }).score).toBe(0);
  });

  it("scores 0 for a matrix without rows", () => {
    expect(scoreMatrix([], {})).toEqual({ score: 0, maxScore: 1 });
  });
});

describe("extractMatrixAnswers", () => {
  it("reads each row's selected columns from the element's own session", () => {
    expect(
      extractMatrixAnswers({ id: "1", answers: { s1: [true, false], s2: [false, "yes"] } }),
    ).toEqual({ s1: [true, false], s2: [false, false] });
  });

  it.each([null, "x", { answers: null }, { answers: [true] }, { data: [] }])(
    "treats a malformed session (%j) as no answer",
    (session) => {
      expect(extractMatrixAnswers(session)).toEqual({});
    },
  );

  it("skips a row whose value isn't a list", () => {
    expect(extractMatrixAnswers({ answers: { s1: true, s2: [true] } })).toEqual({ s2: [true] });
  });
});

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

  it("checkbox: share of correct choices ticked minus share of incorrect ones ticked", () => {
    // Found 1 of 2 correct, fell for none.
    expect(scoreMultipleChoice(checkboxChoices, "checkbox", ["0"])).toEqual({
      score: 0.5, // 1/2 - 0/2
      maxScore: 1,
    });
    // Found both, fell for 1 of 2 incorrect.
    expect(scoreMultipleChoice(checkboxChoices, "checkbox", ["0", "1", "2"])).toEqual({
      score: 0.5, // 2/2 - 1/2
      maxScore: 1,
    });
    // Found 1, fell for 1: cancels out.
    expect(scoreMultipleChoice(checkboxChoices, "checkbox", ["0", "2"])).toEqual({
      score: 0, // 1/2 - 1/2
      maxScore: 1,
    });
  });

  it("checkbox: ticking everything scores 0", () => {
    expect(scoreMultipleChoice(checkboxChoices, "checkbox", ["0", "1", "2", "3"])).toEqual({
      score: 0,
      maxScore: 1,
    });
  });

  it("checkbox: never scores below 0, even when every pick is wrong", () => {
    expect(scoreMultipleChoice(checkboxChoices, "checkbox", ["2", "3"])).toEqual({
      score: 0,
      maxScore: 1,
    });
  });

  it("checkbox: one wrong tick costs less when there are more incorrect choices", () => {
    const sixChoices = [
      { value: "a", correct: true },
      { value: "b", correct: true },
      { value: "c", correct: false },
      { value: "d", correct: false },
      { value: "e", correct: false },
      { value: "f", correct: false },
    ];
    expect(scoreMultipleChoice(sixChoices, "checkbox", ["a", "b", "c"])).toEqual({
      score: 0.75, // 2/2 - 1/4
      maxScore: 1,
    });
  });

  it("checkbox: a question whose choices are all correct scores 1 when all are ticked", () => {
    const allCorrect = [
      { value: "a", correct: true },
      { value: "b", correct: true },
      { value: "c", correct: true },
    ];
    expect(scoreMultipleChoice(allCorrect, "checkbox", ["a", "b", "c"])).toEqual({
      score: 1,
      maxScore: 1,
    });
  });

  it("checkbox: doesn't count 'I don't know' as an incorrect choice", () => {
    // Were it counted, 1 of 3 incorrect ticked would score 2/2 - 1/3 ≈ 0.67.
    expect(scoreMultipleChoice(checkboxChoices, "checkbox", ["0", "1", "2"])).toEqual({
      score: 0.5, // 2/2 - 1/2
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

describe("scoreOrdering", () => {
  const correctOrder = ["a", "b", "c", "d"];

  it("scores 1 for the exact correct order", () => {
    expect(scoreOrdering(correctOrder, ["a", "b", "c", "d"])).toEqual({ score: 1, maxScore: 1 });
  });

  it("scores the share of items left in their correct position", () => {
    // a and c stayed put; b and d swapped.
    expect(scoreOrdering(correctOrder, ["a", "d", "c", "b"])).toEqual({ score: 0.5, maxScore: 1 });
  });

  it("scores 0 when nothing was placed", () => {
    expect(scoreOrdering(correctOrder, [])).toEqual({ score: 0, maxScore: 1 });
  });

  it("scores 0 when every slot is empty", () => {
    expect(scoreOrdering(correctOrder, [null, null, null, null])).toEqual({
      score: 0,
      maxScore: 1,
    });
  });

  it("doesn't credit an item placed at the wrong index, even if it appears elsewhere in the answer", () => {
    expect(scoreOrdering(correctOrder, ["b", "a", "c", "d"])).toEqual({ score: 0.5, maxScore: 1 });
  });

  it("scores 0 for an empty correctOrder rather than dividing by zero", () => {
    expect(scoreOrdering([], ["a"])).toEqual({ score: 0, maxScore: 1 });
  });
});

describe("extractOrderingValues", () => {
  it("reads the choice ids straight off session.value, in order", () => {
    expect(
      extractOrderingValues({
        id: "s1",
        element: "aios-placement-ordering",
        value: ["a", "c", "b"],
      }),
    ).toEqual(["a", "c", "b"]);
  });

  it("keeps a null for an empty slot", () => {
    expect(extractOrderingValues({ value: ["a", null, "c"] })).toEqual(["a", null, "c"]);
  });

  it("treats a non-string, non-null entry as an empty slot rather than trusting it", () => {
    expect(extractOrderingValues({ value: ["a", 42, {}] })).toEqual(["a", null, null]);
  });

  it("returns an empty array for a missing or malformed session", () => {
    expect(extractOrderingValues(undefined)).toEqual([]);
    expect(extractOrderingValues(null)).toEqual([]);
    expect(extractOrderingValues({})).toEqual([]);
    expect(extractOrderingValues({ value: "not-an-array" })).toEqual([]);
  });
});

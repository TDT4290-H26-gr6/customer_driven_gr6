import { describe, expect, it } from "vitest";
import {
  convertContent,
  emptyContent,
  isMatrixType,
  moduleLabel,
  nextOptionId,
  QUESTION_TYPE_INFO,
  questionTypeLabel,
} from "./questionTypes";
import { curriculumModule } from "./testData";

describe("question types", () => {
  it("lists every type the backend supports, each with a label and a hint", () => {
    expect(QUESTION_TYPE_INFO.map((t) => t.type)).toEqual([
      "likert",
      "single_choice",
      "multi_choice",
      "true_false",
      "criteria_check",
      "ordering",
      "true_false_matrix",
      "classification_matrix",
      "matching",
    ]);
    expect(QUESTION_TYPE_INFO.every((t) => t.label && t.hint)).toBe(true);
    expect(questionTypeLabel("criteria_check")).toBe("Judge an example");
    expect(questionTypeLabel("unknown" as never)).toBe("unknown");
  });

  it("gives each type a sensible empty template", () => {
    expect(emptyContent("likert")).toEqual({
      scale: { min: 1, max: 5, minLabel: "", maxLabel: "" },
    });
    expect(emptyContent("true_false")).toMatchObject({
      options: [{ text: "True" }, { text: "False" }],
      correctOptionIds: ["true"],
    });
    expect(emptyContent("criteria_check")).toMatchObject({ exhibit: "", correctOptionIds: [] });
    expect(emptyContent("ordering")).toEqual({
      options: [
        { id: "a", text: "" },
        { id: "b", text: "" },
      ],
    });
    expect(emptyContent("multi_choice")).toMatchObject({ correctOptionIds: [] });
  });
});

describe("nextOptionId", () => {
  it("uses the first free letter, then numbered ids", () => {
    expect(
      nextOptionId([
        { id: "a", text: "" },
        { id: "c", text: "" },
      ]),
    ).toBe("b");
    const all = "abcdefghijklmnopqrstuvwxyz".split("").map((id) => ({ id, text: "" }));
    expect(nextOptionId(all)).toBe("o26");
    expect(nextOptionId([...all, { id: "o26", text: "" }])).toBe("o27");
  });
});

describe("convertContent", () => {
  const options = [
    { id: "a", text: "One" },
    { id: "b", text: "Two" },
  ];

  it("keeps the options, and only the correct answers that still make sense", () => {
    expect(convertContent({ options, correctOptionIds: ["a", "b"] }, "single_choice")).toEqual({
      options,
      correctOptionIds: ["a"],
    });
    expect(convertContent({ options, correctOptionIds: ["b"] }, "multi_choice")).toEqual({
      options,
      correctOptionIds: ["b"],
    });
    expect(convertContent({ options, correctOptionIds: ["a"] }, "criteria_check")).toEqual({
      exhibit: "",
      options,
      correctOptionIds: ["a"],
    });
    expect(convertContent({ options, correctOptionIds: ["a"] }, "ordering")).toEqual({ options });
  });

  const columns = [
    { id: "a", text: "Good" },
    { id: "b", text: "Poor" },
  ];
  const rows = [
    { id: "a", text: "README", correctColumnId: "a" },
    { id: "b", text: "No notes", correctColumnId: "b" },
  ];

  it("starts each matrix type with two rows, and True/False columns for statements", () => {
    expect(emptyContent("true_false_matrix")).toEqual({
      columns: [
        { id: "true", text: "True" },
        { id: "false", text: "False" },
      ],
      rows: [
        { id: "a", text: "", correctColumnId: "true" },
        { id: "b", text: "", correctColumnId: "true" },
      ],
    });
    expect(emptyContent("matching").rows?.map((r) => r.correctColumnId)).toEqual(["", ""]);
    expect(
      ["likert", "matching", "true_false_matrix"].map((t) => isMatrixType(t as never)),
    ).toEqual([false, true, true]);
  });

  it("keeps the rows between matrix types, and their answers where the column still exists", () => {
    expect(convertContent({ columns, rows }, "matching")).toEqual({ columns, rows });
    const statements = convertContent({ columns, rows }, "true_false_matrix");
    expect(statements.columns?.map((c) => c.id)).toEqual(["true", "false"]);
    expect(statements.rows).toEqual([
      { id: "a", text: "README", correctColumnId: "" },
      { id: "b", text: "No notes", correctColumnId: "" },
    ]);
    // Options don't become rows, nor rows options.
    expect(convertContent({ options }, "classification_matrix")).toEqual(
      emptyContent("classification_matrix"),
    );
    expect(convertContent({ columns, rows }, "single_choice")).toEqual(
      emptyContent("single_choice"),
    );
  });

  it("starts fresh where nothing fits", () => {
    expect(convertContent({ options }, "likert")).toEqual(emptyContent("likert"));
    expect(convertContent({ options }, "true_false")).toEqual(emptyContent("true_false"));
    expect(convertContent({ scale: { min: 1, max: 5 } }, "multi_choice")).toEqual(
      emptyContent("multi_choice"),
    );
  });
});

it("plural counts things", async () => {
  const { plural } = await import("./questionTypes");
  expect(plural(1, "question")).toBe("1 question");
  expect(plural(0, "module")).toBe("0 modules");
  expect(plural(3, "module")).toBe("3 modules");
});

it("moduleLabel shows the section code and level when known", () => {
  const module = curriculumModule({ id: "m", name: "Data plans", level: 2 });
  expect(moduleLabel("A", module)).toBe("A · Data plans (level 2)");
  expect(moduleLabel(null, { ...module, level: null })).toBe("Data plans");
});

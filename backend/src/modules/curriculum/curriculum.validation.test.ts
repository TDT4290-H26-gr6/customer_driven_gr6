import { describe, expect, it } from "vitest";
import { validateCompetenceInput, validateQuestionInput } from "./curriculum.validation";

const base = { prompt: "  Which is right?  ", sectionModuleId: "mod-1", competenceId: "c-1" };
const options = [
  { id: "a", text: " Sharing openly " },
  { id: "b", text: "Keeping it closed" },
];

/** Validates a question of `questionType` with `content`, on top of a valid base. */
const check = (questionType: string, content: object, extra: object = {}) =>
  validateQuestionInput({ ...base, questionType, content, ...extra });

const errorOf = (result: ReturnType<typeof check>) => ("error" in result ? result.error : null);

describe("validateQuestionInput: shared rules", () => {
  it("accepts a valid question and trims its text", () => {
    const result = check("single_choice", { options, correctOptionIds: ["a"] });
    expect(result).toEqual({
      data: {
        questionType: "single_choice",
        prompt: "Which is right?",
        sectionModuleId: "mod-1",
        competenceId: "c-1",
        content: {
          options: [
            { id: "a", text: "Sharing openly" },
            { id: "b", text: "Keeping it closed" },
          ],
          correctOptionIds: ["a"],
        },
      },
    });
  });

  it.each([
    [null, "Invalid request body"],
    [{ ...base, questionType: "essay" }, "questionType must be one of"],
    [{ ...base, questionType: "likert", prompt: " " }, "Write the question"],
    [{ ...base, questionType: "likert", prompt: "x".repeat(2001) }, "too long"],
    [{ ...base, questionType: "likert", sectionModuleId: "" }, "Choose a module"],
    [{ ...base, questionType: "likert", competenceId: 3 }, "Choose a competence"],
  ])("rejects %j", (body, message) => {
    expect(errorOf(validateQuestionInput(body))).toContain(message);
  });
});

describe("validateQuestionInput: options", () => {
  it.each([
    [{ options: [options[0]] }, "at least 2 options"],
    [
      { options: Array.from({ length: 13 }, (_, i) => ({ id: `o${i}`, text: `T${i}` })) },
      "at most 12",
    ],
    [{ options: [{ id: "a b", text: "x" }, options[1]] }, "valid id"],
    [{ options: [{ id: "a", text: " " }, options[1]] }, "needs some text"],
    [{ options: [{ id: "a", text: "x".repeat(501) }, options[1]] }, "too long"],
    [{ options: [options[0], { id: "a", text: "Other" }] }, "same id"],
    [{ options: [options[0], { id: "b", text: "SHARING OPENLY" }] }, "same text"],
  ])("rejects %j", (content, message) => {
    expect(errorOf(check("multi_choice", { ...content, correctOptionIds: ["a"] }))).toContain(
      message,
    );
  });

  it("rejects a correct answer that isn't one of the options", () => {
    expect(errorOf(check("multi_choice", { options, correctOptionIds: ["z"] }))).toContain(
      "doesn't exist",
    );
  });
});

describe("validateQuestionInput: per question type", () => {
  it("single choice and true/false need exactly one correct option", () => {
    expect(errorOf(check("single_choice", { options, correctOptionIds: ["a", "b"] }))).toContain(
      "exactly one",
    );
    expect(errorOf(check("true_false", { options, correctOptionIds: [] }))).toContain(
      "exactly one",
    );
    expect(check("true_false", { options, correctOptionIds: ["b"] })).toHaveProperty("data");
  });

  it("true/false has exactly two options", () => {
    const three = [...options, { id: "c", text: "Maybe" }];
    expect(errorOf(check("true_false", { options: three, correctOptionIds: ["a"] }))).toContain(
      "exactly two",
    );
  });

  it("multiple choice needs at least one correct option, so full marks are reachable", () => {
    expect(errorOf(check("multi_choice", { options, correctOptionIds: [] }))).toContain(
      "at least one",
    );
    expect(check("multi_choice", { options, correctOptionIds: ["a", "b", "a"] })).toMatchObject({
      data: { content: { correctOptionIds: ["a", "b"] } },
    });
  });

  it("criteria check needs the example to judge, and at least one criterion it meets", () => {
    expect(errorOf(check("criteria_check", { options, correctOptionIds: ["a"] }))).toContain(
      "example",
    );
    expect(
      errorOf(
        check("criteria_check", { exhibit: "x".repeat(5001), options, correctOptionIds: ["a"] }),
      ),
    ).toContain("too long");
    expect(
      errorOf(check("criteria_check", { exhibit: "README", options, correctOptionIds: [] })),
    ).toContain("at least one");
    expect(
      check("criteria_check", { exhibit: " README.md \n", options, correctOptionIds: ["a"] }),
    ).toMatchObject({ data: { content: { exhibit: "README.md" } } });
  });

  it("ordering takes the options in their correct order", () => {
    expect(check("ordering", { options: [options[1], options[0]] })).toMatchObject({
      data: { content: { correctOrder: ["b", "a"] } },
    });
  });

  it("likert: a whole-number scale running upwards within 0-10", () => {
    expect(check("likert", { scale: { min: 1, max: 5, minLabel: " Low ", maxLabel: "" } })).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          content: { scale: { min: 1, max: 5, minLabel: "Low", maxLabel: undefined } },
        }),
      }),
    );
    for (const scale of [{ min: 1.5, max: 5 }, { min: 5, max: 1 }, { min: 0, max: 11 }, {}]) {
      expect(errorOf(check("likert", { scale }))).toMatch(/scale/);
    }
    expect(
      errorOf(check("likert", { scale: { min: 1, max: 2, minLabel: "x".repeat(501) } })),
    ).toContain("too long");
  });

  it("likert: labels for every step, or none", () => {
    expect(
      check("likert", { scale: { min: 1, max: 3, labels: ["Never", "Sometimes", "Always"] } }),
    ).toMatchObject({ data: { content: { scale: { labels: ["Never", "Sometimes", "Always"] } } } });
    expect(
      errorOf(check("likert", { scale: { min: 1, max: 3, labels: ["Never", "Always"] } })),
    ).toContain("every step");
    expect(
      errorOf(check("likert", { scale: { min: 1, max: 2, labels: ["x".repeat(501), "b"] } })),
    ).toContain("too long");
  });
});

describe("validateCompetenceInput", () => {
  it("accepts a name and an optional description", () => {
    expect(validateCompetenceInput({ name: " FAIR data ", description: " " })).toEqual({
      data: { name: "FAIR data", description: null },
    });
    expect(validateCompetenceInput({ name: "Licensing", description: "Open licences" })).toEqual({
      data: { name: "Licensing", description: "Open licences" },
    });
  });

  it.each([
    [null, "Invalid"],
    [{ name: " " }, "name"],
    [{ name: "x".repeat(192) }, "too long"],
    [{ name: "OK", description: "x".repeat(2001) }, "too long"],
  ])("rejects %j", (body, message) => {
    const result = validateCompetenceInput(body);
    expect("error" in result && result.error).toContain(message);
  });
});

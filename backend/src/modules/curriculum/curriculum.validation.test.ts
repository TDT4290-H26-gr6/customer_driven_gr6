import { describe, expect, it } from "vitest";
import {
  validateCompetenceInput,
  validateJourneyInput,
  validateModuleInput,
  validateQuestionInput,
  validateSectionInput,
} from "./curriculum.validation";

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

describe("validateSectionInput", () => {
  it("accepts a name with an optional code and description", () => {
    expect(
      validateSectionInput({ code: " F ", name: " Open education ", description: "" }),
    ).toEqual({
      data: { code: "F", name: "Open education", description: null },
    });
    expect(validateSectionInput({ name: "Untitled" })).toEqual({
      data: { code: null, name: "Untitled", description: null },
    });
  });

  it.each([
    [null, "Invalid"],
    [{ name: "" }, "name"],
    [{ name: "x".repeat(192) }, "too long"],
    [{ name: "OK", code: "TOOLONGCODE" }, "at most 10"],
    [{ name: "OK", description: "x".repeat(2001) }, "too long"],
  ])("rejects %j", (body, message) => {
    const result = validateSectionInput(body);
    expect("error" in result && result.error).toContain(message);
  });
});

describe("validateModuleInput", () => {
  const module = {
    name: " Open licences ",
    sectionId: "sec-a",
    mainCompetenceId: "c-1",
    level: 2,
    secondaryCompetenceIds: ["c-2", "c-2", "c-1"],
    moodleUrl: " https://moodle.ntnu.no/course/view.php?id=7 ",
  };

  it("accepts a module, dropping duplicate and main-competence secondaries", () => {
    expect(validateModuleInput(module)).toEqual({
      data: {
        name: "Open licences",
        description: null,
        sectionId: "sec-a",
        level: 2,
        mainCompetenceId: "c-1",
        secondaryCompetenceIds: ["c-2"],
        moodleUrl: "https://moodle.ntnu.no/course/view.php?id=7",
      },
    });
  });

  it("allows no level, no secondaries and no Moodle link", () => {
    expect(
      validateModuleInput({ name: "X", sectionId: "s", mainCompetenceId: "c", level: null }),
    ).toMatchObject({ data: { level: null, secondaryCompetenceIds: [], moodleUrl: null } });
    expect(
      validateModuleInput({
        name: "X",
        sectionId: "s",
        mainCompetenceId: "c",
        moodleUrl: "http://localhost:8080/x",
      }),
    ).toMatchObject({ data: { moodleUrl: "http://localhost:8080/x" } });
  });

  it.each([
    [null, "Invalid"],
    [{ ...module, name: " " }, "name"],
    [{ ...module, name: "x".repeat(192) }, "too long"],
    [{ ...module, description: "x".repeat(5001) }, "too long"],
    [{ ...module, sectionId: "" }, "section"],
    [{ ...module, mainCompetenceId: undefined }, "main competence"],
    [{ ...module, level: 0 }, "level"],
    [{ ...module, level: 21 }, "level"],
    [{ ...module, level: 1.5 }, "level"],
    [{ ...module, secondaryCompetenceIds: "c-2" }, "secondary"],
    [{ ...module, secondaryCompetenceIds: [""] }, "secondary"],
    [
      { ...module, secondaryCompetenceIds: Array.from({ length: 21 }, (_, i) => `c${i}`) },
      "at most 20",
    ],
    [{ ...module, moodleUrl: "javascript:alert(1)" }, "Moodle link"],
    [{ ...module, moodleUrl: "http://moodle.ntnu.no" }, "Moodle link"],
    [{ ...module, moodleUrl: "not a url" }, "Moodle link"],
    [{ ...module, moodleUrl: `https://x.no/${"a".repeat(512)}` }, "Moodle link"],
  ])("rejects %j", (body, message) => {
    const result = validateModuleInput(body);
    expect("error" in result && result.error).toContain(message);
  });
});

describe("validateJourneyInput", () => {
  const journey = {
    name: " Data steward ",
    description: " For research data work ",
    moodleUrl: "https://moodle.ntnu.no/course/view.php?id=3",
    sections: [
      { sectionId: "sec-a", coverageLevel: "M" },
      { sectionId: "sec-b", coverageLevel: "R" },
    ],
    steps: [
      { id: "step-1", title: " Plan your data ", description: "", sourceId: "src-1" },
      { title: "Share it", sourceId: "" },
    ],
  };

  it("accepts a journey, trimming text and marking which steps are new", () => {
    expect(validateJourneyInput(journey)).toEqual({
      data: {
        name: "Data steward",
        description: "For research data work",
        moodleUrl: "https://moodle.ntnu.no/course/view.php?id=3",
        sections: journey.sections,
        steps: [
          { id: "step-1", title: "Plan your data", description: null, sourceId: "src-1" },
          { id: null, title: "Share it", description: null, sourceId: null },
        ],
      },
    });
  });

  it("allows no steps, no description and no Moodle link", () => {
    expect(
      validateJourneyInput({ name: "X", sections: [{ sectionId: "s", coverageLevel: "M" }] }),
    ).toEqual({
      data: {
        name: "X",
        description: null,
        moodleUrl: null,
        sections: [{ sectionId: "s", coverageLevel: "M" }],
        steps: [],
      },
    });
  });

  it.each([
    [null, "Invalid"],
    [{ ...journey, name: "" }, "name"],
    [{ ...journey, name: "x".repeat(192) }, "too long"],
    [{ ...journey, description: "x".repeat(5001) }, "too long"],
    [{ ...journey, moodleUrl: "javascript:alert(1)" }, "Moodle link"],
    [{ ...journey, sections: "sec-a" }, "Invalid sections"],
    [
      {
        ...journey,
        sections: Array.from({ length: 51 }, (_, i) => ({
          sectionId: `s${i}`,
          coverageLevel: "M",
        })),
      },
      "Invalid sections",
    ],
    [{ ...journey, sections: [{ sectionId: "sec-a", coverageLevel: "X" }] }, "M, R or S"],
    [{ ...journey, sections: [{ sectionId: "", coverageLevel: "M" }] }, "M, R or S"],
    [{ ...journey, sections: ["sec-a"] }, "M, R or S"],
    [
      {
        ...journey,
        sections: [
          { sectionId: "a", coverageLevel: "M" },
          { sectionId: "a", coverageLevel: "R" },
        ],
      },
      "listed twice",
    ],
    [
      { ...journey, sections: [{ sectionId: "a", coverageLevel: "R" }] },
      "at least one section as M",
    ],
    [{ ...journey, sections: [] }, "at least one section as M"],
    [{ ...journey, steps: "step" }, "Invalid steps"],
    [{ ...journey, steps: ["step"] }, "Invalid steps"],
    [
      { ...journey, steps: Array.from({ length: 31 }, (_, i) => ({ title: `Step ${i}` })) },
      "at most 30",
    ],
    [{ ...journey, steps: [{ title: " " }] }, "needs a title"],
    [{ ...journey, steps: [{ title: "x".repeat(192) }] }, "too long"],
    [{ ...journey, steps: [{ title: "OK", description: "x".repeat(5001) }] }, "too long"],
  ])("rejects %j", (body, message) => {
    const result = validateJourneyInput(body);
    expect("error" in result && result.error).toContain(message);
  });
});

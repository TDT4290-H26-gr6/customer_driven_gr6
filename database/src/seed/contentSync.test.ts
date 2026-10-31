import { describe, expect, it, vi } from "vitest";
import {
  formatPlan,
  hasChanges,
  newRowsOnly,
  planContentSync,
  type CurrentContent,
} from "./contentSync";

vi.mock("../db/prisma", () => ({ prisma: {} }));

const SECTION = "aios.assessment.section";
const MODULE = "aios.assessment.section_module";
const QUESTION = "aios.assessment.question";
const JOURNEY = "aios.learningJourney.journey";
const JOURNEY_SECTION = "aios.learningJourney.journey_section";
const SOURCE = "aios.sources.source";

const section = { id: "sec-a", code: "A", name: "Foundations", description: null };
const module = {
  id: "mod-a1",
  name: "A1",
  description: null,
  mainCompetenceId: "comp-1",
  sectionId: "sec-a",
  level: 1,
  moodleUrl: "https://moodle.example.org/course/view.php?id=1",
};
const question = {
  id: "q-1",
  prompt: "What is Open Science?",
  questionType: "single_choice",
  content: {
    options: [
      { id: "a", text: "Sharing research openly" },
      { id: "b", text: "Something else" },
    ],
    correctOptionIds: ["a"],
  },
  sectionModuleId: "mod-a1",
  competenceId: "comp-1",
};
const journey = { id: "lj-1", name: "LJ1", description: "First", moodleUrl: null };

/** A file holding exactly these rows. */
function file(tables: Record<string, object[]>) {
  return tables;
}

/** The database as it is once `tables` has been synced into an empty one. */
function syncedFrom(tables: Record<string, object[]>): CurrentContent {
  const plan = planContentSync(tables, {}, new Set());
  const current: CurrentContent = {};
  const tableOf: Record<string, string> = {
    section: SECTION,
    sectionModule: MODULE,
    question: QUESTION,
    learningJourney: JOURNEY,
    journeySection: JOURNEY_SECTION,
    source: SOURCE,
  };
  for (const c of plan.creates) (current[tableOf[c.model]] ??= []).push({ ...c.data });
  return current;
}

describe("planContentSync", () => {
  it("creates every row of an empty database", () => {
    const plan = planContentSync(
      file({ [SECTION]: [section], [MODULE]: [module], [QUESTION]: [question] }),
      {},
      new Set(),
    );

    expect(plan.creates.map((c) => `${c.label} ${c.key}`)).toEqual([
      "Section sec-a",
      "Section module mod-a1",
      "Question q-1",
    ]);
    expect(plan.updates).toEqual([]);
  });

  it("sees no change in a database that matches the file", () => {
    const tables = { [SECTION]: [section], [MODULE]: [module], [QUESTION]: [question] };

    expect(hasChanges(planContentSync(tables, syncedFrom(tables), new Set()))).toBe(false);
  });

  it("ignores the key order MySQL gives a JSON column, Decimals and timestamps", () => {
    const tables = { [QUESTION]: [question], [SOURCE]: [{ id: "src-1", credits: 7.5 }] };
    const current = syncedFrom(tables);
    const stored = current[QUESTION][0];
    // Same content, keys in another order.
    stored.content = Object.fromEntries(Object.entries(stored.content as object).reverse());
    stored.updatedAt = new Date();
    current[SOURCE][0].credits = { toNumber: () => 7.5 };

    expect(hasChanges(planContentSync(tables, current, new Set()))).toBe(false);
  });

  it("updates only the fields that changed", () => {
    const current = syncedFrom({ [JOURNEY]: [journey] });

    const plan = planContentSync(
      file({ [JOURNEY]: [{ ...journey, name: "LJ1 renamed" }] }),
      current,
      new Set(),
    );

    expect(plan.updates).toEqual([
      expect.objectContaining({
        key: "lj-1",
        where: { id: "lj-1" },
        data: { name: "LJ1 renamed" },
      }),
    ]);
  });

  it("rebuilds a question's PIE content when its prompt changes", () => {
    const current = syncedFrom({ [QUESTION]: [question] });

    const plan = planContentSync(
      file({ [QUESTION]: [{ ...question, prompt: "What is Open Science, really?" }] }),
      current,
      new Set(),
    );

    expect(plan.updates[0].changes.map((c) => c.field)).toEqual(["prompt", "content"]);
  });

  it("removes a link the file left out, keyed by its compound id", () => {
    const links = [
      { journeyId: "lj-1", sectionId: "sec-a", coverageLevel: "M" },
      { journeyId: "lj-1", sectionId: "sec-b", coverageLevel: "R" },
    ];
    const current = syncedFrom({ [JOURNEY]: [journey], [JOURNEY_SECTION]: links });

    const plan = planContentSync(
      file({ [JOURNEY]: [journey], [JOURNEY_SECTION]: [links[0]] }),
      current,
      new Set(),
    );

    expect(plan.linkRemovals).toEqual([
      expect.objectContaining({
        key: "lj-1 / sec-b",
        where: { journeyId_sectionId: { journeyId: "lj-1", sectionId: "sec-b" } },
      }),
    ]);
  });

  it("only reports rows the file no longer has, and leaves the links of journeys not in it", () => {
    const link = { journeyId: "lj-1", sectionId: "sec-a", coverageLevel: "M" };
    const current = syncedFrom({
      [SECTION]: [section],
      [JOURNEY]: [journey],
      [JOURNEY_SECTION]: [link],
    });

    const plan = planContentSync(file({}), current, new Set());

    expect(plan.notInFile).toEqual([
      { label: "Section", key: "sec-a" },
      { label: "Learning journey", key: "lj-1" },
    ]);
    expect(plan.linkRemovals).toEqual([]);
    expect(hasChanges(plan)).toBe(false);
  });

  it("warns that a new question lowers old results in a section people were assessed in", () => {
    const current = syncedFrom({ [MODULE]: [module] });
    const tables = file({ [MODULE]: [module], [QUESTION]: [question] });

    expect(planContentSync(tables, current, new Set(["sec-a"])).warnings).toEqual([
      expect.stringContaining("New question q-1 is in section sec-a"),
    ]);
    expect(planContentSync(tables, current, new Set()).warnings).toEqual([]);
  });

  it("warns when a question moves out of an assessed section", () => {
    const other = { ...module, id: "mod-b1", name: "B1", sectionId: "sec-b" };
    const current = syncedFrom({ [MODULE]: [module, other], [QUESTION]: [question] });

    const plan = planContentSync(
      file({ [MODULE]: [module, other], [QUESTION]: [{ ...question, sectionModuleId: "mod-b1" }] }),
      current,
      new Set(["sec-a"]),
    );

    expect(plan.warnings).toEqual([
      expect.stringContaining("Question q-1 moves to another module"),
    ]);
  });

  it("warns when a module's level changes in an assessed section", () => {
    const current = syncedFrom({ [MODULE]: [module] });

    const plan = planContentSync(
      file({ [MODULE]: [{ ...module, level: 2 }] }),
      current,
      new Set(["sec-a"]),
    );

    expect(plan.warnings).toEqual([expect.stringContaining("Module mod-a1 changes level")]);
  });

  it("doesn't warn about wording changes", () => {
    const current = syncedFrom({ [MODULE]: [module], [QUESTION]: [question] });

    const plan = planContentSync(
      file({
        [MODULE]: [{ ...module, name: "A1 renamed" }],
        [QUESTION]: [{ ...question, prompt: "Edited?" }],
      }),
      current,
      new Set(["sec-a"]),
    );

    expect(plan.updates).toHaveLength(2);
    expect(plan.warnings).toEqual([]);
  });
});

describe("newRowsOnly (--only-new)", () => {
  const STEP = "aios.learningJourney.learning_module";
  const newQuestion = { ...question, id: "q-2", prompt: "A new item" };
  const all = {
    [SECTION]: [section],
    [MODULE]: [module],
    [QUESTION]: [question, newQuestion],
    [JOURNEY]: [journey],
    [JOURNEY_SECTION]: [{ journeyId: "lj-1", sectionId: "sec-a", coverageLevel: "M" }],
  };

  it("adds only what the database doesn't have, changing nothing that's there", () => {
    // In the editor: the question reworded, the journey's coverage removed.
    const current = syncedFrom({
      [SECTION]: [section],
      [MODULE]: [module],
      [QUESTION]: [question],
      [JOURNEY]: [journey],
    });
    current[QUESTION][0].prompt = "Reworded in the editor";

    const plan = planContentSync(newRowsOnly(all, current, new Set()), current, new Set());

    expect(plan.creates.map((c) => c.key)).toEqual(["q-2"]);
    expect(plan.updates).toEqual([]);
    expect(plan.linkRemovals).toEqual([]);
  });

  it("doesn't bring back what an admin deleted in the editor", () => {
    const current = syncedFrom({ [SECTION]: [section], [MODULE]: [module] });
    const plan = planContentSync(
      newRowsOnly(all, current, new Set(["question:q-2", "journey:lj-1"])),
      current,
      new Set(),
    );
    expect(plan.creates.map((c) => `${c.label} ${c.key}`)).toEqual(["Question q-1"]);
  });

  it("adds a new journey with its coverage and steps, but no step of an existing journey", () => {
    const steps = [
      {
        id: "step-1",
        journeyId: "lj-1",
        order: 1,
        title: "Plan",
        description: null,
        sourceId: null,
      },
      {
        id: "step-2",
        journeyId: "lj-2",
        order: 1,
        title: "Share",
        description: null,
        sourceId: null,
      },
    ];
    const tables = {
      ...all,
      [JOURNEY]: [journey, { ...journey, id: "lj-2", name: "LJ2" }],
      [JOURNEY_SECTION]: [
        { journeyId: "lj-1", sectionId: "sec-a", coverageLevel: "M" },
        { journeyId: "lj-2", sectionId: "sec-a", coverageLevel: "M" },
      ],
      [STEP]: steps,
    };
    const current = syncedFrom({ [SECTION]: [section], [MODULE]: [module], [JOURNEY]: [journey] });
    const filtered = newRowsOnly(tables, current, new Set());
    expect(filtered[JOURNEY].map((j) => j.id)).toEqual(["lj-2"]);
    expect(filtered[JOURNEY_SECTION]).toEqual([tables[JOURNEY_SECTION][1]]);
    expect(filtered[STEP]).toEqual([steps[1]]);
  });
});

describe("formatPlan", () => {
  it("says when there's nothing to change", () => {
    const tables = { [JOURNEY]: [journey] };

    expect(formatPlan(planContentSync(tables, syncedFrom(tables), new Set()))).toContain(
      "No changes",
    );
  });

  it("shows where a long text starts to differ, so an edit near the end is visible", () => {
    const long = "A description long enough that the report has to cut it short somewhere";
    const current = syncedFrom({ [JOURNEY]: [{ ...journey, description: long }] });

    const report = formatPlan(
      planContentSync(
        file({ [JOURNEY]: [{ ...journey, description: `${long}!` }] }),
        current,
        new Set(),
      ),
    );

    expect(report).toContain(
      'description: "...t it short somewhere" -> "...t it short somewhere!"',
    );
  });
});

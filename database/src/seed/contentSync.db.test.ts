import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../db/prisma";
import {
  applyContentSync,
  formatPlan,
  hasChanges,
  loadAssessedSectionIds,
  loadCurrentContent,
  planContentSync,
  type SyncPlan,
} from "./contentSync";

// The sync's database steps against a fake Prisma client: every model has
// findMany/create/update/delete mocks, and the transaction client is the
// client itself (so the order of writes can be read off one call log).
vi.mock("../db/prisma", () => {
  const writes: string[] = [];
  const models: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
  const model = (name: string) =>
    (models[name] ??= {
      findMany: vi.fn(async () => [{ id: `${name}-row` }]),
      create: vi.fn(async () => writes.push(`create ${name}`)),
      update: vi.fn(async () => writes.push(`update ${name}`)),
      delete: vi.fn(async () => writes.push(`delete ${name}`)),
    });
  const client: Record<string, unknown> = new Proxy(
    {
      writes,
      $transaction: vi.fn((run: (tx: unknown) => unknown) => run(client)),
    },
    {
      get: (target, key: string) =>
        key in target ? target[key as keyof typeof target] : model(key),
    },
  );
  return { prisma: client };
});

type FakeModel = Record<"findMany" | "create" | "update" | "delete", ReturnType<typeof vi.fn>>;
const db = prisma as unknown as Record<string, FakeModel> & {
  $transaction: ReturnType<typeof vi.fn>;
  writes: string[];
};

const emptyPlan = (): SyncPlan => ({
  creates: [],
  updates: [],
  linkRemovals: [],
  notInFile: [],
  warnings: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  db.writes.length = 0;
});

describe("loadCurrentContent", () => {
  it("reads every content table, keyed by its dataset table name", async () => {
    const current = await loadCurrentContent();
    expect(current["aios.assessment.section"]).toEqual([{ id: "section-row" }]);
    expect(current["aios.assessment.question"]).toEqual([{ id: "question-row" }]);
    expect(current["aios.learningJourney.journey"]).toEqual([{ id: "learningJourney-row" }]);
  });
});

describe("loadAssessedSectionIds", () => {
  it("returns the sections a completed assessment has answers in", async () => {
    db.section.findMany.mockResolvedValueOnce([{ id: "sec-a" }, { id: "sec-b" }]);

    expect(await loadAssessedSectionIds()).toEqual(new Set(["sec-a", "sec-b"]));
    // Only completed assessments count: an attempt in progress hasn't produced results.
    expect(JSON.stringify(db.section.findMany.mock.calls[0][0])).toContain(
      '"completedAt":{"not":null}',
    );
  });
});

describe("applyContentSync", () => {
  it("writes the plan in one transaction: removals first, then table by table", async () => {
    const plan = emptyPlan();
    plan.creates.push(
      { model: "question", label: "Question", key: "q-1", data: { id: "q-1" } },
      { model: "section", label: "Section", key: "sec-a", data: { id: "sec-a" } },
    );
    plan.updates.push({
      model: "sectionModule",
      label: "Module",
      key: "mod-a1",
      where: { id: "mod-a1" },
      data: { level: 2 },
      changes: [{ field: "level", from: 1, to: 2 }],
    });
    plan.linkRemovals.push({
      model: "journeySection",
      label: "Journey section",
      key: "lj-1 / sec-a",
      where: { journeyId_sectionId: { journeyId: "lj-1", sectionId: "sec-a" } },
    });

    await applyContentSync(plan);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    // A row is written only after everything it points at: sections, then
    // modules, then the questions in them.
    expect(db.writes).toEqual([
      "delete journeySection",
      "create section",
      "update sectionModule",
      "create question",
    ]);
    expect(db.sectionModule.update).toHaveBeenCalledWith({
      where: { id: "mod-a1" },
      data: { level: 2 },
    });
  });
});

describe("hasChanges", () => {
  it("is true only when there's something to write", () => {
    const plan = emptyPlan();
    plan.notInFile.push({ label: "Section", key: "old" });
    plan.warnings.push("a warning");
    expect(hasChanges(plan)).toBe(false);

    plan.linkRemovals.push({
      model: "journeySection",
      label: "Journey section",
      key: "k",
      where: {},
    });
    expect(hasChanges(plan)).toBe(true);
  });
});

describe("formatPlan", () => {
  it("lists creates, updates, removals, rows only in the database, and warnings", () => {
    const plan = emptyPlan();
    plan.creates.push({ model: "section", label: "Section", key: "sec-z", data: {} });
    plan.updates.push({
      model: "question",
      label: "Question",
      key: "q-1",
      where: { id: "q-1" },
      data: {},
      changes: [
        { field: "prompt", from: "Old wording", to: "New wording" },
        { field: "content", from: {}, to: { models: [] } },
        { field: "description", from: null, to: "Now described" },
      ],
    });
    plan.linkRemovals.push({
      model: "journeySection",
      label: "Journey section",
      key: "lj-1 / sec-a",
      where: {},
    });
    plan.notInFile.push({ label: "Section", key: "sec-old" });
    plan.warnings.push("Module mod-a1 changes level");

    expect(formatPlan(plan).split("\n")).toEqual([
      "+ Section sec-z: new",
      "~ Question q-1:",
      '    prompt: "Old wording" -> "New wording"',
      "    content: changed",
      '    description: (empty) -> "Now described"',
      "- Journey section lj-1 / sec-a: removed",
      "",
      "In the database but not in the file (left as they are, never deleted):",
      "  Section sec-old",
      "",
      "Warnings — these change results already given on the dashboard:",
      "  ! Module mod-a1 changes level",
      "  (History is unaffected: it keeps its own copies.)",
    ]);
  });
});

describe("warnings for sections people were assessed in", () => {
  const MODULE = "aios.assessment.section_module";
  const module = { id: "mod-a1", sectionId: "sec-a", level: 1, mainCompetenceId: "comp-1" };

  /** The database after syncing `tables` into an empty one. */
  function synced(tables: Record<string, object[]>) {
    const current: Record<string, Record<string, unknown>[]> = {};
    for (const c of planContentSync(tables, {}, new Set()).creates) {
      (current[MODULE] ??= []).push({ ...c.data });
    }
    return current;
  }

  it("warns that a new module changes skill levels in an assessed section", () => {
    const plan = planContentSync({ [MODULE]: [module] }, {}, new Set(["sec-a"]));
    expect(plan.warnings).toEqual([
      expect.stringContaining("New module mod-a1 is in section sec-a"),
    ]);
  });

  it("warns when a module moves to another section from an assessed one", () => {
    const plan = planContentSync(
      { [MODULE]: [{ ...module, sectionId: "sec-b" }] },
      synced({ [MODULE]: [module] }),
      new Set(["sec-a"]),
    );
    expect(plan.warnings).toEqual([expect.stringContaining("Module mod-a1 changes section")]);
  });
});

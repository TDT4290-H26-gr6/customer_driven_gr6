import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { historiesFrom, listChangeLog, recordChange, snapshot } from "./curriculum.audit";

vi.mock("../../db/prisma", () => {
  const model = () => ({ findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() });
  return {
    prisma: {
      question: model(),
      competence: model(),
      section: model(),
      sectionModule: model(),
      learningJourney: model(),
      auditEvent: model(),
    },
  };
});

const db = vi.mocked(prisma, true);
const tx = db as unknown as Prisma.TransactionClient;
const actor = { id: "admin-1", name: "Ada Admin", email: "ada@ntnu.no" };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("snapshot", () => {
  it("is a module's values, its secondary competences as a list of ids", async () => {
    db.sectionModule.findUnique.mockResolvedValue({
      name: "Licences",
      level: 2,
      secondaryCompetences: [{ competenceId: "c-2" }, { competenceId: "c-3" }],
    } as never);
    expect(await snapshot(tx, "module", "mod-1")).toEqual({
      name: "Licences",
      level: 2,
      secondaryCompetenceIds: ["c-2", "c-3"],
    });
  });

  it("is a journey's values, with its steps", async () => {
    db.learningJourney.findUnique.mockResolvedValue({
      name: "Data steward",
      sections: [{ sectionId: "sec-a", coverageLevel: "M" }],
      modules: [{ id: "step-1", order: 1, title: "Plan" }],
    } as never);
    expect(await snapshot(tx, "journey", "lj-1")).toEqual({
      name: "Data steward",
      sections: [{ sectionId: "sec-a", coverageLevel: "M" }],
      steps: [{ id: "step-1", order: 1, title: "Plan" }],
    });
  });

  it.each(["question", "competence", "section", "module", "journey"] as const)(
    "is null for a %s that doesn't exist",
    async (type) => {
      for (const model of Object.values(db)) model.findUnique.mockResolvedValue(null);
      expect(await snapshot(tx, type, "nope")).toBeNull();
    },
  );
});

describe("recordChange", () => {
  it("logs who changed what, with the values before and after as JSON", async () => {
    const retiredAt = new Date("2026-10-31T12:00:00Z");
    await recordChange(tx, actor, {
      entityType: "section",
      entityId: "sec-a",
      action: "retired",
      before: { name: "Open science", retiredAt: null },
      after: { name: "Open science", retiredAt },
    });
    expect(db.auditEvent.create).toHaveBeenCalledWith({
      data: {
        actorId: "admin-1",
        actorName: "Ada Admin",
        actorEmail: "ada@ntnu.no",
        entityType: "section",
        entityId: "sec-a",
        entityLabel: "Open science",
        action: "retired",
        before: { name: "Open science", retiredAt: null },
        after: { name: "Open science", retiredAt: "2026-10-31T12:00:00.000Z" },
      },
    });
  });

  it("names a deleted question by its prompt, shortened to fit", async () => {
    await recordChange(tx, actor, {
      entityType: "question",
      entityId: "q-1",
      action: "deleted",
      before: { prompt: "x".repeat(300) },
      after: null,
    });
    const { data } = db.auditEvent.create.mock.calls[0][0];
    expect(data.entityLabel).toHaveLength(191);
    expect(data.entityLabel).toMatch(/\.\.\.$/);
    expect(data.after).toBeUndefined();
  });
});

describe("historiesFrom", () => {
  const at = (day: number) => new Date(`2026-10-${day}T12:00:00Z`);
  const entry = (entityId: string, action: string, day: number, actorName: string | null) => ({
    entityType: "section",
    entityId,
    action,
    createdAt: at(day),
    actorName,
    actorEmail: "bo@ntnu.no",
  });

  it("keeps who added each item and its latest change", () => {
    const histories = historiesFrom([
      entry("sec-a", "created", 1, "Ada"),
      entry("sec-a", "edited", 2, "Ada"),
      entry("sec-a", "retired", 3, null),
      entry("sec-b", "edited", 4, "Ada"),
    ]);
    expect(histories.get("section:sec-a")).toEqual({
      created: { at: at(1), by: "Ada" },
      lastChange: { at: at(3), by: "bo@ntnu.no", action: "retired" },
    });
    // Loaded from the dataset, so nobody added it in the editor.
    expect(histories.get("section:sec-b")).toEqual({
      created: null,
      lastChange: { at: at(4), by: "Ada", action: "edited" },
    });
  });
});

describe("listChangeLog", () => {
  it("is every entry oldest first, its values as JSON text", async () => {
    db.auditEvent.findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-10-31T12:00:00Z"),
        actorName: null,
        actorEmail: "ada@ntnu.no",
        action: "created",
        entityType: "competence",
        entityId: "c-9",
        entityLabel: "Licensing",
        before: null,
        after: { name: "Licensing" },
      },
    ] as never);
    expect(await listChangeLog()).toEqual([
      {
        at: "2026-10-31T12:00:00.000Z",
        actorName: null,
        actorEmail: "ada@ntnu.no",
        action: "created",
        entityType: "competence",
        entityId: "c-9",
        entityLabel: "Licensing",
        before: null,
        after: '{"name":"Licensing"}',
      },
    ]);
    expect(db.auditEvent.findMany).toHaveBeenCalledWith({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });
});

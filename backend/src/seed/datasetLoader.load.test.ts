import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../db/prisma";
import { createDatasetLoader } from "./datasetLoader";

// The loader against a fake Prisma client: every model gets createMany
// (which "inserts" all rows), updateMany and count mocks. The transaction
// client and the plain client are the same fake.
vi.mock("../db/prisma", () => {
  const models: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
  const model = (name: string) =>
    (models[name] ??= {
      createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
      updateMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 0),
    });
  const client: Record<string, unknown> = new Proxy(
    { $transaction: vi.fn((run: (tx: unknown) => unknown) => run(client)) },
    { get: (target, key: string) => (key in target ? target[key as "$transaction"] : model(key)) },
  );
  return { prisma: client };
});

type FakeModel = Record<"createMany" | "updateMany" | "count", ReturnType<typeof vi.fn>>;
const db = prisma as unknown as Record<string, FakeModel> & {
  $transaction: ReturnType<typeof vi.fn>;
};

const dataset = {
  "aios.sources.source": [
    {
      id: "src-1",
      courseName: "FAIR basics",
      moodleCourseId: 7,
      createdAt: "2026-01-02T03:04:05Z",
    },
  ],
  "aios.identity.role": [{ id: "role-1", name: "Data steward" }],
  "aios.assessment.competence": [
    { id: "c-1", name: "FAIR data", primarySourceId: "src-1" },
    { id: "c-2", name: "Licensing" },
  ],
  "aios.assessment.section": [{ id: "sec-1", code: "A", name: "Data management" }],
  "aios.assessment.section_module": [{ id: "mod-1", level: 2, moodleCourseId: 9 }],
  "aios.assessment.question": [
    {
      id: "q-1",
      questionType: "true_false",
      prompt: "Is FAIR about data?",
      content: {
        options: [
          { id: "t", text: "True" },
          { id: "f", text: "False" },
        ],
      },
    },
  ],
  "aios.learningJourney.journey": [
    { id: "lj-1", name: "Steward path", moodleUrl: "https://moodle.ntnu.no/lj" },
    { id: "lj-2", name: "No link yet" },
  ],
  "aios.identity.learner": [
    { id: "learner-1", email: "a@example.com", hasCompletedInitialAssessment: 1 },
  ],
};

/** The rows the loader handed to a model's createMany. */
const inserted = (model: string) => db[model].createMany.mock.calls[0][0].data;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createDatasetLoader", () => {
  it("exposes the dataset's own section and question ids", () => {
    const loader = createDatasetLoader(dataset);
    expect(loader.sectionIds).toEqual(["sec-1"]);
    expect(loader.questionIds).toEqual(["q-1"]);
  });

  it("copes with a dataset that leaves tables out", () => {
    const loader = createDatasetLoader({});
    expect(loader.sectionIds).toEqual([]);
    expect(loader.questionIds).toEqual([]);
  });
});

describe("seed", () => {
  it("inserts every table in one transaction, skipping rows that already exist", async () => {
    const counts = await createDatasetLoader(dataset).seed();

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(counts).toMatchObject({
      source: 1,
      role: 1,
      competence: 2,
      section: 1,
      section_module: 1,
      question: 1,
      journey: 2,
      learner: 1,
      role_section: 0,
    });
    for (const model of ["source", "question", "learningJourney"]) {
      expect(db[model].createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true }),
      );
    }
  });

  it("turns timestamps into Dates and builds Moodle links from course ids", async () => {
    await createDatasetLoader(dataset).seed();

    const [source] = inserted("source");
    expect(source.createdAt).toEqual(new Date("2026-01-02T03:04:05Z"));
    expect(source.sourceUrl).toMatch(/\/course\/view\.php\?id=7$/);
    expect(source).not.toHaveProperty("moodleCourseId");

    const [module] = inserted("sectionModule");
    expect(module.moodleUrl).toMatch(/\/course\/view\.php\?id=9$/);
  });

  it("stores questions as PIE items", async () => {
    await createDatasetLoader(dataset).seed();
    const [question] = inserted("question");
    expect(question.content).toMatchObject({
      elements: expect.any(Object),
      models: expect.any(Array),
    });
  });

  it("stores the learner's completion flag as a boolean", async () => {
    await createDatasetLoader(dataset).seed();
    expect(inserted("learner")[0].hasCompletedInitialAssessment).toBe(true);
  });
});

describe("seedIfIncomplete", () => {
  it("loads the dataset when its questions or sources are missing", async () => {
    db.question.count.mockResolvedValue(0);
    db.source.count.mockResolvedValue(1);

    expect(await createDatasetLoader(dataset).seedIfIncomplete()).toBe(true);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("skips loading when everything is there and nothing changed", async () => {
    db.question.count.mockResolvedValue(1);
    db.source.count.mockResolvedValue(1);

    expect(await createDatasetLoader(dataset).seedIfIncomplete()).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("brings existing rows up to date and reports the change", async () => {
    db.question.count.mockResolvedValue(1);
    db.source.count.mockResolvedValue(1);
    db.section.updateMany.mockResolvedValue({ count: 1 });

    expect(await createDatasetLoader(dataset).seedIfIncomplete()).toBe(true);
    expect(db.$transaction).not.toHaveBeenCalled();

    // Names, codes and levels are only rewritten where they differ.
    expect(db.competence.updateMany).toHaveBeenCalledWith({
      where: { id: "c-1", name: { not: "FAIR data" } },
      data: { name: "FAIR data" },
    });
    expect(db.section.updateMany).toHaveBeenCalledWith({
      where: {
        id: "sec-1",
        OR: [{ code: null }, { code: { not: "A" } }, { name: { not: "Data management" } }],
      },
      data: { code: "A", name: "Data management" },
    });
    expect(db.sectionModule.updateMany).toHaveBeenCalledWith({
      where: { id: "mod-1", OR: [{ level: null }, { level: { not: 2 } }] },
      data: { level: 2 },
    });
  });

  it("links a competence to its primary source only when the dataset gives one", async () => {
    db.question.count.mockResolvedValue(1);
    db.source.count.mockResolvedValue(1);

    await createDatasetLoader(dataset).seedIfIncomplete();

    const primarySourceUpdates = db.competence.updateMany.mock.calls.filter(
      ([args]) => "primarySourceId" in args.data,
    );
    expect(primarySourceUpdates).toEqual([
      [expect.objectContaining({ data: { primarySourceId: "src-1" } })],
    ]);
  });

  it("updates Moodle links, and clears one the dataset no longer has", async () => {
    db.question.count.mockResolvedValue(1);
    db.source.count.mockResolvedValue(1);

    await createDatasetLoader(dataset).seedIfIncomplete();

    expect(db.learningJourney.updateMany).toHaveBeenCalledWith({
      where: {
        id: "lj-1",
        OR: [{ moodleUrl: null }, { moodleUrl: { not: "https://moodle.ntnu.no/lj" } }],
      },
      data: { moodleUrl: "https://moodle.ntnu.no/lj" },
    });
    expect(db.learningJourney.updateMany).toHaveBeenCalledWith({
      where: { id: "lj-2", moodleUrl: { not: null } },
      data: { moodleUrl: null },
    });
  });
});

import { Prisma } from "@prisma/client";
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

  it("stores questions as PIE items, and as authored for the curriculum editor", async () => {
    await createDatasetLoader(dataset).seed();
    const [question] = inserted("question");
    expect(question.content).toMatchObject({
      elements: expect.any(Object),
      models: expect.any(Array),
    });
    expect(question.authoredContent).toEqual(dataset["aios.assessment.question"][0].content);
  });

  it("stores the learner's completion flag as a boolean", async () => {
    await createDatasetLoader(dataset).seed();
    expect(inserted("learner")[0].hasCompletedInitialAssessment).toBe(true);
  });
});

describe("seedIfEmpty", () => {
  it("loads the dataset into a database that holds none of it", async () => {
    db.section.count.mockResolvedValue(0);

    expect(await createDatasetLoader(dataset).seedIfEmpty()).toBe(true);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.section.count).toHaveBeenCalledWith({ where: { id: { in: ["sec-1"] } } });
  });

  it("never reloads or overwrites a database that already has its content", async () => {
    db.section.count.mockResolvedValue(1);

    expect(await createDatasetLoader(dataset).seedIfEmpty()).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
    // Nothing an admin may have edited is touched: only empty authored content is filled.
    for (const model of ["section", "sectionModule", "competence", "learningJourney"]) {
      expect(db[model].updateMany).not.toHaveBeenCalled();
    }
  });

  it("fills in authored content only where it's missing", async () => {
    db.section.count.mockResolvedValue(1);
    db.question.updateMany.mockResolvedValue({ count: 1 });

    expect(await createDatasetLoader(dataset).seedIfEmpty()).toBe(true);
    expect(db.question.updateMany).toHaveBeenCalledWith({
      where: { id: "q-1", authoredContent: { equals: Prisma.DbNull } },
      data: { authoredContent: dataset["aios.assessment.question"][0].content },
    });
  });
});

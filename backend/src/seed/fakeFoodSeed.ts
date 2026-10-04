import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { buildPieContent, type AuthoredContent } from "../modules/assessment/assessment.pie";
import seedData from "./data/aios_fake_food_seed.json";

// Loads the FAKE food-themed dataset in data/aios_fake_food_seed.json — every
// table of schema v3 except the ones a learner fills in themselves
// (sat_instance, response, competence_score, recommendation), so a freshly
// signed-in learner starts with all questions unanswered.
//
// Runs automatically at backend start when any of this dataset's questions
// are missing (see seedIfIncomplete and index.ts) and by hand via
// `npx prisma db seed`. Every insert skips rows that already exist, so it is
// safe to run again. The whole load is one transaction: if any table fails,
// nothing is kept, and the next start simply tries again.

type Row = Record<string, unknown>;

const tables = seedData as unknown as Record<string, Row[]>;

// The seed authors a source's Moodle course by id, not a full URL, so the
// real Moodle base can be swapped in in one place later.
const MOODLE_BASE_URL = "https://moodle.example.org";

function moodleUrl(courseId: unknown): string {
  return `${MOODLE_BASE_URL}/course/view.php?id=${courseId}`;
}

/** The JSON stores timestamps as ISO strings; Prisma wants Dates. */
function withDates(row: Row): Row {
  const out = { ...row };
  for (const key of ["createdAt", "updatedAt"]) {
    if (typeof out[key] === "string") out[key] = new Date(out[key] as string);
  }
  return out;
}

function table<T>(name: string, map: (row: Row) => Row = (row) => row): T[] {
  return (tables[name] ?? []).map((row) => map(withDates(row))) as unknown as T[];
}

/** Generous: the default 5 s interactive-transaction timeout is too short for the full dataset. */
const SEED_TIMEOUT_MS = 60_000;

export function seedFakeFood() {
  return prisma.$transaction(seedTables, { timeout: SEED_TIMEOUT_MS, maxWait: SEED_TIMEOUT_MS });
}

async function seedTables(tx: Prisma.TransactionClient) {
  const counts: Record<string, number> = {};
  const insert = async (name: string, run: () => Promise<{ count: number }>) => {
    counts[name] = (await run()).count;
  };

  // Order matters: a table is inserted only after every table it points at.
  await insert("source", () =>
    tx.source.createMany({
      data: table<Prisma.SourceCreateManyInput>("aios.sources.source", (row) => {
        const { moodleCourseId, ...rest } = row;
        return { ...rest, sourceUrl: moodleUrl(moodleCourseId) };
      }),
      skipDuplicates: true,
    }),
  );
  await insert("role", () =>
    tx.role.createMany({
      data: table<Prisma.RoleCreateManyInput>("aios.identity.role"),
      skipDuplicates: true,
    }),
  );
  await insert("competence", () =>
    tx.competence.createMany({
      data: table<Prisma.CompetenceCreateManyInput>("aios.assessment.competence"),
      skipDuplicates: true,
    }),
  );
  await insert("competence_secondary_source", () =>
    tx.competenceSecondarySource.createMany({
      data: table<Prisma.CompetenceSecondarySourceCreateManyInput>(
        "aios.assessment.competence_secondary_source",
      ),
      skipDuplicates: true,
    }),
  );
  await insert("section", () =>
    tx.section.createMany({
      data: table<Prisma.SectionCreateManyInput>("aios.assessment.section"),
      skipDuplicates: true,
    }),
  );
  await insert("section_module", () =>
    tx.sectionModule.createMany({
      data: table<Prisma.SectionModuleCreateManyInput>("aios.assessment.section_module"),
      skipDuplicates: true,
    }),
  );
  await insert("section_module_secondary_competence", () =>
    tx.sectionModuleSecondaryCompetence.createMany({
      data: table<Prisma.SectionModuleSecondaryCompetenceCreateManyInput>(
        "aios.assessment.section_module_secondary_competence",
      ),
      skipDuplicates: true,
    }),
  );
  await insert("question", () =>
    tx.question.createMany({
      data: table<Prisma.QuestionCreateManyInput>("aios.assessment.question", (row) => ({
        ...row,
        // The seed authors questions in a simple shape; the app stores (and
        // renders) them as PIE items.
        content: buildPieContent(
          String(row.questionType),
          String(row.prompt),
          row.content as AuthoredContent,
        ),
      })),
      skipDuplicates: true,
    }),
  );
  await insert("journey", () =>
    tx.learningJourney.createMany({
      data: table<Prisma.LearningJourneyCreateManyInput>("aios.learningJourney.journey"),
      skipDuplicates: true,
    }),
  );
  await insert("journey_section", () =>
    tx.journeySection.createMany({
      data: table<Prisma.JourneySectionCreateManyInput>("aios.learningJourney.journey_section"),
      skipDuplicates: true,
    }),
  );
  await insert("learning_module", () =>
    tx.learningModule.createMany({
      data: table<Prisma.LearningModuleCreateManyInput>("aios.learningJourney.learning_module"),
      skipDuplicates: true,
    }),
  );
  await insert("learner", () =>
    tx.learner.createMany({
      data: table<Prisma.LearnerCreateManyInput>("aios.identity.learner", (row) => ({
        ...row,
        hasCompletedInitialAssessment: Boolean(row.hasCompletedInitialAssessment),
      })),
      skipDuplicates: true,
    }),
  );
  await insert("role_section", () =>
    tx.roleSection.createMany({
      data: table<Prisma.RoleSectionCreateManyInput>("aios.identity.role_section"),
      skipDuplicates: true,
    }),
  );
  await insert("role_competence", () =>
    tx.roleCompetence.createMany({
      data: table<Prisma.RoleCompetenceCreateManyInput>("aios.identity.role_competence"),
      skipDuplicates: true,
    }),
  );

  return counts;
}

/**
 * Gives existing fake sections their code (A–E) and name, modules their
 * level (1–4) and competences their name from the dataset — createMany's skipDuplicates
 * never updates rows that are already there, so a database seeded earlier
 * would otherwise keep old values. Only touches rows whose value differs,
 * so it's a no-op (and leaves updatedAt alone) once they match.
 */
async function syncCodesAndLevels() {
  let changed = 0;
  for (const competence of tables["aios.assessment.competence"] ?? []) {
    const name = competence.name as string;
    const { count } = await prisma.competence.updateMany({
      where: { id: String(competence.id), name: { not: name } },
      data: { name },
    });
    changed += count;
  }
  for (const section of tables["aios.assessment.section"] ?? []) {
    const code = section.code as string;
    const name = section.name as string;
    const { count } = await prisma.section.updateMany({
      where: {
        id: String(section.id),
        OR: [{ code: null }, { code: { not: code } }, { name: { not: name } }],
      },
      data: { code, name },
    });
    changed += count;
  }
  for (const module of tables["aios.assessment.section_module"] ?? []) {
    const level = module.level as number;
    const { count } = await prisma.sectionModule.updateMany({
      where: { id: String(module.id), OR: [{ level: null }, { level: { not: level } }] },
      data: { level },
    });
    changed += count;
  }
  return changed;
}

/**
 * Loads the dataset when any of its own questions are missing — a fresh
 * database, or one seeded before questions were added to it — then makes
 * sure section codes and names, module levels and competence names match it. Every insert skips rows
 * that exist, so this only ever adds. Deliberately keyed on this dataset's
 * question ids, not "the question bank is empty": if the real open-science
 * seed (openScienceSeed.ts, currently dormant) is ever turned back on
 * alongside this one, its questions mustn't count as "already seeded".
 * Returns whether anything was added or changed.
 */
export async function seedIfIncomplete() {
  const fakeQuestionIds = (tables["aios.assessment.question"] ?? []).map((row) => String(row.id));
  const present = await prisma.question.count({ where: { id: { in: fakeQuestionIds } } });
  const seeded = present < fakeQuestionIds.length;
  if (seeded) await seedFakeFood();
  const synced = (await syncCodesAndLevels()) > 0;
  return seeded || synced;
}

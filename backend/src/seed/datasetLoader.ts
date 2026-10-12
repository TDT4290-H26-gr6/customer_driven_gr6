import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { config } from "../config";
import { buildPieContent, type AuthoredContent } from "../modules/assessment/assessment.pie";

// Loads one content dataset (a JSON file in data/) into the database: every
// table of schema v3 except the ones a learner fills in themselves
// (sat_instance, response, competence_score, recommendation), so a freshly
// signed-in learner starts with all questions unanswered. Used for both the
// fake food-themed dataset and the real WP2 curriculum (see seed/index.ts).
//
// Every insert skips rows that already exist, so it is safe to run again. The
// whole load is one transaction: if any table fails, nothing is kept, and the
// next start simply tries again.

type Row = Record<string, unknown>;

/** Generous: the default 5 s interactive-transaction timeout is too short for a full dataset. */
const SEED_TIMEOUT_MS = 60_000;

/** The JSON stores timestamps as ISO strings; Prisma wants Dates. */
function withDates(row: Row): Row {
  const out = { ...row };
  for (const key of ["createdAt", "updatedAt"]) {
    if (typeof out[key] === "string") out[key] = new Date(out[key] as string);
  }
  return out;
}

/**
 * A row's Moodle link. Seed data names the Moodle course by id
 * (`moodleCourseId`), so the real Moodle site can be swapped in in one place
 * (MOODLE_BASE_URL); a row that already knows its full link gives it as
 * `moodleUrl` instead, which wins. Null when the row has neither.
 * (A source outside Moodle — a partner institution's own course page —
 * gives its `sourceUrl` directly instead; see withMoodleLink.)
 */
export function moodleLink(row: Row, baseUrl = config.moodleBaseUrl): string | null {
  if (typeof row.moodleUrl === "string" && row.moodleUrl) return row.moodleUrl;
  if (row.moodleCourseId === undefined || row.moodleCourseId === null) return null;
  return `${baseUrl}/course/view.php?id=${row.moodleCourseId}`;
}

/**
 * The row without the authoring-only Moodle fields, plus the built link under
 * `key`. A source that gives its own `sourceUrl` (a partner's course page,
 * not Moodle) keeps it.
 */
export function withMoodleLink(row: Row, key: "moodleUrl" | "sourceUrl"): Row {
  const own = key === "sourceUrl" && typeof row.sourceUrl === "string" && row.sourceUrl;
  const out: Row = { ...row, [key]: own || moodleLink(row) };
  delete out.moodleCourseId;
  if (key !== "moodleUrl") delete out.moodleUrl;
  return out;
}

export function createDatasetLoader(data: unknown) {
  const tables = data as Record<string, Row[]>;

  function table<T>(name: string, map: (row: Row) => Row = (row) => row): T[] {
    return (tables[name] ?? []).map((row) => map(withDates(row))) as unknown as T[];
  }

  const sectionIds = (tables["aios.assessment.section"] ?? []).map((row) => String(row.id));
  const questionIds = (tables["aios.assessment.question"] ?? []).map((row) => String(row.id));
  const sourceIds = (tables["aios.sources.source"] ?? []).map((row) => String(row.id));

  async function seedTables(tx: Prisma.TransactionClient) {
    const counts: Record<string, number> = {};
    const insert = async (name: string, run: () => Promise<{ count: number }>) => {
      counts[name] = (await run()).count;
    };

    // Order matters: a table is inserted only after every table it points at.
    await insert("source", () =>
      tx.source.createMany({
        data: table<Prisma.SourceCreateManyInput>("aios.sources.source", (row) =>
          withMoodleLink(row, "sourceUrl"),
        ),
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
        data: table<Prisma.SectionModuleCreateManyInput>("aios.assessment.section_module", (row) =>
          withMoodleLink(row, "moodleUrl"),
        ),
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
        data: table<Prisma.LearningJourneyCreateManyInput>("aios.learningJourney.journey", (row) =>
          withMoodleLink(row, "moodleUrl"),
        ),
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

  function seed() {
    return prisma.$transaction(seedTables, { timeout: SEED_TIMEOUT_MS, maxWait: SEED_TIMEOUT_MS });
  }

  /**
   * Brings rows seeded earlier up to date with the dataset: section codes and
   * names, module levels, competence names and Moodle links (so swapping the
   * placeholder links for real ones is a data change). createMany's
   * skipDuplicates never updates rows that are already there. Only touches
   * rows whose value differs, so it's a no-op (and leaves updatedAt alone)
   * once they match.
   */
  async function syncExistingRows() {
    let changed = 0;
    for (const competence of tables["aios.assessment.competence"] ?? []) {
      const name = competence.name as string;
      const { count } = await prisma.competence.updateMany({
        where: { id: String(competence.id), name: { not: name } },
        data: { name },
      });
      changed += count;
      // A competence given its primary source after it was first seeded.
      const primarySourceId = (competence.primarySourceId as string | undefined) ?? null;
      if (primarySourceId) {
        const { count: linked } = await prisma.competence.updateMany({
          where: {
            id: String(competence.id),
            OR: [{ primarySourceId: null }, { primarySourceId: { not: primarySourceId } }],
          },
          data: { primarySourceId },
        });
        changed += linked;
      }
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
      changed += await syncMoodleUrl("sectionModule", String(module.id), moodleLink(module));
    }
    for (const journey of tables["aios.learningJourney.journey"] ?? []) {
      changed += await syncMoodleUrl("learningJourney", String(journey.id), moodleLink(journey));
    }
    return changed;
  }

  async function syncMoodleUrl(
    model: "sectionModule" | "learningJourney",
    id: string,
    moodleUrl: string | null,
  ) {
    const where =
      moodleUrl === null
        ? { id, moodleUrl: { not: null } }
        : { id, OR: [{ moodleUrl: null }, { moodleUrl: { not: moodleUrl } }] };
    const { count } =
      model === "sectionModule"
        ? await prisma.sectionModule.updateMany({ where, data: { moodleUrl } })
        : await prisma.learningJourney.updateMany({ where, data: { moodleUrl } });
    return count;
  }

  /**
   * Loads the dataset when any of its own questions or sources are missing —
   * a fresh database, or one seeded before they were added to it — then
   * brings existing rows up to date (syncExistingRows). Keyed on this
   * dataset's ids, not "the question bank is empty". Returns whether
   * anything was added or changed.
   */
  async function seedIfIncomplete() {
    const [questionsPresent, sourcesPresent] = await Promise.all([
      prisma.question.count({ where: { id: { in: questionIds } } }),
      prisma.source.count({ where: { id: { in: sourceIds } } }),
    ]);
    const seeded = questionsPresent < questionIds.length || sourcesPresent < sourceIds.length;
    if (seeded) await seed();
    const synced = (await syncExistingRows()) > 0;
    return seeded || synced;
  }

  return { seed, seedIfIncomplete, sectionIds, questionIds };
}

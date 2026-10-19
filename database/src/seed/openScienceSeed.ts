import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { buildPieContent, type AuthoredContent } from "../modules/assessment/assessment.pie";
import seedData from "./data/aios_open_science_seed.json";

// Loads the REAL open-science content (CD-74): the sources, competences,
// sections/modules and questions authored from the curated course list and
// the 21 real self-assessment questions that existed before the schema
// overhaul (CD-72), re-authored into the new Section → SectionModule →
// Competence hierarchy. Two of the five original competence areas ("Research
// Data and Metadata Management", "Reproducibility and Research Workflows")
// are seeded as bare Competence rows only — no section/module/questions have
// ever been authored for them, in the old schema or this one.
//
// Currently DORMANT: neither index.ts nor prisma/seed.ts calls
// seedOpenScienceContent(); everyone's initial assessment is the fake
// dataset instead (see assessment.service.ts's isInitialAssessment). Kept
// here to seed later — call it from either of those two files to re-enable.
// Every insert skips rows that already exist, so it is safe to run again.

type Row = Record<string, unknown>;

const tables = seedData as unknown as Record<string, Row[]>;

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

/**
 * The real (non-fake) personas this content is for. Granted the real
 * sections/competences below; the FAKE roles stay exclusively on fake
 * content. These names may already exist in the database from before this
 * seed existed — upserted by `name` (its unique key) rather than inserted
 * with a fixed id, so an existing role keeps its existing id and just gets
 * the grants added, instead of silently ending up with two rows for the
 * same persona.
 */
const REAL_ROLE_NAMES = [
  "Administrator",
  "CEO",
  "Librarian",
  "Other",
  "Professor",
  "Research Data Steward",
  "Researcher",
  "Student",
] as const;

async function ensureRealRoles() {
  return Promise.all(
    REAL_ROLE_NAMES.map((name) =>
      prisma.role.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );
}

const REAL_SECTION_IDS = [
  "section-real-open-science-policy",
  "section-real-legal-ethics-governance",
  "section-real-ai-tools",
];

export async function seedOpenScienceContent() {
  const counts: Record<string, number> = {};
  const insert = async (name: string, run: () => Promise<{ count: number }>) => {
    counts[name] = (await run()).count;
  };

  // What already existed before this run — see the role_section insert below.
  const [existingSections, existingRoles] = await Promise.all([
    prisma.section.findMany({ where: { id: { in: REAL_SECTION_IDS } }, select: { id: true } }),
    prisma.role.findMany({ where: { name: { in: [...REAL_ROLE_NAMES] } }, select: { name: true } }),
  ]);
  const sectionExisted = new Set(existingSections.map((s) => s.id));
  const roleExisted = new Set(existingRoles.map((r) => r.name));

  // Order matters: a table is inserted only after every table it points at.
  await insert("source", () =>
    prisma.source.createMany({
      data: table<Prisma.SourceCreateManyInput>("aios.sources.source"),
      skipDuplicates: true,
    }),
  );
  await insert("competence", () =>
    prisma.competence.createMany({
      data: table<Prisma.CompetenceCreateManyInput>("aios.assessment.competence"),
      skipDuplicates: true,
    }),
  );
  await insert("section", () =>
    prisma.section.createMany({
      data: table<Prisma.SectionCreateManyInput>("aios.assessment.section"),
      skipDuplicates: true,
    }),
  );
  await insert("section_module", () =>
    prisma.sectionModule.createMany({
      data: table<Prisma.SectionModuleCreateManyInput>("aios.assessment.section_module"),
      skipDuplicates: true,
    }),
  );
  await insert("question", () =>
    prisma.question.createMany({
      data: table<Prisma.QuestionCreateManyInput>("aios.assessment.question", (row) => ({
        ...row,
        content: buildPieContent(
          String(row.questionType),
          String(row.prompt),
          row.content as AuthoredContent,
        ),
      })),
      skipDuplicates: true,
    }),
  );

  // Grant a real section to a real role only when one of them is new in
  // this run. This seed runs on every boot, so re-granting existing pairs
  // would silently undo any grant an admin revoked in admin mode.
  const roles = await ensureRealRoles();
  await insert("role_section", () =>
    prisma.roleSection.createMany({
      data: roles.flatMap((role) =>
        REAL_SECTION_IDS.filter(
          (sectionId) => !roleExisted.has(role.name) || !sectionExisted.has(sectionId),
        ).map((sectionId) => ({ roleId: role.id, sectionId })),
      ),
      skipDuplicates: true,
    }),
  );

  return counts;
}

import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { buildPieContent, type AuthoredContent } from "./pie";
import { withMoodleLink } from "./datasetLoader";

// `npm run content:sync` (see contentSync.cli.ts): makes the database match
// a dataset JSON file while the app keeps running. The startup seed only
// adds missing rows and refreshes a few fields; this also updates every
// field of rows that are already there, so editing a question, section,
// module or learning journey in the file is enough.
//
// - Rows are matched by id. A new id is created; an existing one gets every
//   field the file gives it.
// - Rows in the database but not in the file are only reported, never
//   deleted: answers, scores and History point at them.
// - Link rows (a journey's sections, a module's secondary competences, a
//   competence's secondary sources) hold no learner data, so they follow the
//   file exactly, one left out of the file is removed.
// - Changes that would alter old results on the dashboard and "See results
//   by section" (which recompute from today's questions; History doesn't)
//   come with a warning.
//
// planContentSync is pure (file + database rows in, plan out), so every rule
// is unit-testable; applyContentSync writes a plan in one transaction.

type Row = Record<string, unknown>;

type ModelName =
  | "source"
  | "competence"
  | "competenceSecondarySource"
  | "section"
  | "sectionModule"
  | "sectionModuleSecondaryCompetence"
  | "question"
  | "learningJourney"
  | "journeySection"
  | "learningModule";

type TableSpec = {
  /** The table's key in the dataset JSON. */
  table: string;
  /** How the report names it. */
  label: string;
  model: ModelName;
  /** Primary key fields, one `id`, or the pair a link table is keyed on. */
  key: string[];
  /** The authored row as the database stores it. */
  map?: (row: Row) => Row;
  /** For a link table: the field naming its owner, and the owner's table. Links of owners in the file follow the file. */
  owner?: { field: string; table: string };
};

/** Every content table, in the order they're written: a table only after every table it points at. */
const TABLES: TableSpec[] = [
  {
    table: "aios.sources.source",
    label: "Source",
    model: "source",
    key: ["id"],
    map: (row) => withMoodleLink(row, "sourceUrl"),
  },
  { table: "aios.assessment.competence", label: "Competence", model: "competence", key: ["id"] },
  {
    table: "aios.assessment.competence_secondary_source",
    label: "Competence secondary source",
    model: "competenceSecondarySource",
    key: ["competenceId", "sourceId"],
    owner: { field: "competenceId", table: "aios.assessment.competence" },
  },
  { table: "aios.assessment.section", label: "Section", model: "section", key: ["id"] },
  {
    table: "aios.assessment.section_module",
    label: "Section module",
    model: "sectionModule",
    key: ["id"],
    map: (row) => withMoodleLink(row, "moodleUrl"),
  },
  {
    table: "aios.assessment.section_module_secondary_competence",
    label: "Module secondary competence",
    model: "sectionModuleSecondaryCompetence",
    key: ["moduleId", "competenceId"],
    owner: { field: "moduleId", table: "aios.assessment.section_module" },
  },
  {
    table: "aios.assessment.question",
    label: "Question",
    model: "question",
    key: ["id"],
    // The file authors questions in a simple shape; the app stores (and
    // renders) them as PIE items, the same build the seed uses.
    map: (row) => ({
      ...row,
      content: buildPieContent(
        String(row.questionType),
        String(row.prompt),
        row.content as AuthoredContent,
      ),
    }),
  },
  {
    table: "aios.learningJourney.journey",
    label: "Learning journey",
    model: "learningJourney",
    key: ["id"],
    map: (row) => withMoodleLink(row, "moodleUrl"),
  },
  {
    table: "aios.learningJourney.journey_section",
    label: "Journey section",
    model: "journeySection",
    key: ["journeyId", "sectionId"],
    owner: { field: "journeyId", table: "aios.learningJourney.journey" },
  },
  {
    table: "aios.learningJourney.learning_module",
    label: "Learning module",
    model: "learningModule",
    key: ["id"],
  },
];

/** Bookkeeping columns: never compared or written. */
const IGNORED_FIELDS = new Set(["createdAt", "updatedAt"]);

export type FieldChange = { field: string; from: unknown; to: unknown };

export type SyncPlan = {
  creates: { model: ModelName; label: string; key: string; data: Row }[];
  updates: {
    model: ModelName;
    label: string;
    key: string;
    where: Row;
    data: Row;
    changes: FieldChange[];
  }[];
  linkRemovals: { model: ModelName; label: string; key: string; where: Row }[];
  /** Rows in the database that the file no longer has, reported, not deleted. */
  notInFile: { label: string; key: string }[];
  /** Changes that alter results already given on the dashboard and "See results by section". */
  warnings: string[];
};

/** The database's current rows, per dataset table. */
export type CurrentContent = Record<string, Row[]>;

/** Prisma's delegates share these calls; one shape lets every table go through the same code. */
type Delegate = {
  findMany(args?: object): Promise<Row[]>;
  create(args: { data: Row }): Promise<unknown>;
  update(args: { where: Row; data: Row }): Promise<unknown>;
  delete(args: { where: Row }): Promise<unknown>;
};

function delegate(client: Prisma.TransactionClient, model: ModelName): Delegate {
  return client[model] as unknown as Delegate;
}

function keyOf(spec: TableSpec, row: Row): string {
  return spec.key.map((field) => String(row[field])).join(" / ");
}

/** Prisma's unique selector: `{ id }`, or `{ journeyId_sectionId: {…} }` for a compound key. */
function whereOf(spec: TableSpec, row: Row): Row {
  const fields = Object.fromEntries(spec.key.map((field) => [field, row[field]]));
  return spec.key.length === 1 ? fields : { [spec.key.join("_")]: fields };
}

function withoutIgnored(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([field]) => !IGNORED_FIELDS.has(field)));
}

/** A value as the file would write it: Decimals as numbers, Dates as ISO strings, missing as null. */
function normalize(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { toNumber?: unknown }).toNumber === "function"
  ) {
    return (value as { toNumber(): number }).toNumber();
  }
  return value;
}

/** JSON with object keys sorted, MySQL reorders the keys of a JSON column, so plain stringify would see a change in every question. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Row).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

function sameValue(a: unknown, b: unknown): boolean {
  return stableJson(normalize(a)) === stableJson(normalize(b));
}

/**
 * What it takes to make the database match the file: rows to create, fields
 * to update, links to remove, rows the file no longer has, and warnings for
 * changes that alter results already given. `assessedSectionIds`: sections
 * at least one completed assessment has answers in.
 */
export function planContentSync(
  data: unknown,
  current: CurrentContent,
  assessedSectionIds: ReadonlySet<string>,
): SyncPlan {
  const tables = data as Record<string, Row[] | undefined>;
  const plan: SyncPlan = {
    creates: [],
    updates: [],
    linkRemovals: [],
    notInFile: [],
    warnings: [],
  };

  // Each module's section, as it will be once synced, what the warnings
  // need to tell which section a question lands in.
  const sectionOfModule = new Map<string, string>();
  for (const row of current["aios.assessment.section_module"] ?? []) {
    sectionOfModule.set(String(row.id), String(row.sectionId));
  }
  const currentSectionOfModule = new Map(sectionOfModule);
  for (const row of tables["aios.assessment.section_module"] ?? []) {
    sectionOfModule.set(String(row.id), String(row.sectionId));
  }

  for (const spec of TABLES) {
    const desired = (tables[spec.table] ?? []).map((row) =>
      withoutIgnored(spec.map ? spec.map(row) : row),
    );
    const existing = new Map((current[spec.table] ?? []).map((row) => [keyOf(spec, row), row]));
    const desiredKeys = new Set(desired.map((row) => keyOf(spec, row)));

    for (const row of desired) {
      const key = keyOf(spec, row);
      const before = existing.get(key);
      if (!before) {
        plan.creates.push({ model: spec.model, label: spec.label, key, data: row });
        warnAboutCreate(plan, spec, row, sectionOfModule, assessedSectionIds);
        continue;
      }
      const changes = Object.entries(row)
        .filter(([field]) => !spec.key.includes(field))
        .filter(([field, value]) => !sameValue(before[field], value))
        .map(([field, value]) => ({ field, from: normalize(before[field]), to: value }));
      if (changes.length === 0) continue;
      plan.updates.push({
        model: spec.model,
        label: spec.label,
        key,
        where: whereOf(spec, row),
        data: Object.fromEntries(changes.map((c) => [c.field, c.to])),
        changes,
      });
      warnAboutUpdate(
        plan,
        spec,
        key,
        before,
        row,
        changes,
        currentSectionOfModule,
        sectionOfModule,
        assessedSectionIds,
      );
    }

    const ownersInFile = spec.owner
      ? new Set((tables[spec.owner.table] ?? []).map((row) => String(row.id)))
      : null;
    for (const [key, row] of existing) {
      if (desiredKeys.has(key)) continue;
      if (spec.owner && ownersInFile?.has(String(row[spec.owner.field]))) {
        plan.linkRemovals.push({
          model: spec.model,
          label: spec.label,
          key,
          where: whereOf(spec, row),
        });
      } else if (!spec.owner) {
        plan.notInFile.push({ label: spec.label, key });
      }
    }
  }

  return plan;
}

function warnAboutCreate(
  plan: SyncPlan,
  spec: TableSpec,
  row: Row,
  sectionOfModule: ReadonlyMap<string, string>,
  assessedSectionIds: ReadonlySet<string>,
) {
  if (spec.model === "question") {
    const sectionId = sectionOfModule.get(String(row.sectionModuleId));
    if (sectionId && assessedSectionIds.has(sectionId)) {
      plan.warnings.push(
        `New question ${String(row.id)} is in section ${sectionId}, which people have already been ` +
          `assessed in. Their old results there will drop: a question never asked counts as 0.`,
      );
    }
  }
  if (spec.model === "sectionModule" && assessedSectionIds.has(String(row.sectionId))) {
    plan.warnings.push(
      `New module ${String(row.id)} is in section ${String(row.sectionId)}, which people have ` +
        `already been assessed in. Their skill level there will be recalculated against it.`,
    );
  }
}

function warnAboutUpdate(
  plan: SyncPlan,
  spec: TableSpec,
  key: string,
  before: Row,
  after: Row,
  changes: FieldChange[],
  currentSectionOfModule: ReadonlyMap<string, string>,
  sectionOfModule: ReadonlyMap<string, string>,
  assessedSectionIds: ReadonlySet<string>,
) {
  const changed = (field: string) => changes.some((c) => c.field === field);
  const anyAssessed = (...ids: (string | undefined)[]) =>
    ids.some((id) => id !== undefined && assessedSectionIds.has(id));

  if (spec.model === "question" && (changed("sectionModuleId") || changed("competenceId"))) {
    const from = currentSectionOfModule.get(String(before.sectionModuleId));
    const to = sectionOfModule.get(String(after.sectionModuleId));
    if (anyAssessed(from, to)) {
      plan.warnings.push(
        `Question ${key} moves to another ` +
          `${changed("sectionModuleId") ? "module" : "competence"}. Old answers to it will be ` +
          `counted there in old results.`,
      );
    }
  }

  if (spec.model === "sectionModule" && (changed("level") || changed("sectionId"))) {
    if (anyAssessed(String(before.sectionId), String(after.sectionId))) {
      plan.warnings.push(
        `Module ${key} changes ${changed("level") ? "level" : "section"} in a section people ` +
          `have already been assessed in. Their skill level there will be recalculated.`,
      );
    }
  }
}

/** Every content table's current rows. */
export async function loadCurrentContent(): Promise<CurrentContent> {
  const entries = await Promise.all(
    TABLES.map(
      async (spec) => [spec.table, await delegate(prisma, spec.model).findMany()] as const,
    ),
  );
  return Object.fromEntries(entries);
}

/** Sections at least one completed assessment has answers in, where structural changes alter old results. */
export async function loadAssessedSectionIds(): Promise<Set<string>> {
  const sections = await prisma.section.findMany({
    where: {
      modules: {
        some: {
          questions: {
            some: {
              responses: { some: { satInstance: { completedAt: { not: null } } } },
            },
          },
        },
      },
    },
    select: { id: true },
  });
  return new Set(sections.map((s) => s.id));
}

/** Generous: a full dataset is a few hundred writes. */
const SYNC_TIMEOUT_MS = 60_000;

/** Writes a plan in one transaction, if any write fails, nothing is kept. */
export async function applyContentSync(plan: SyncPlan): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      for (const removal of plan.linkRemovals) {
        await delegate(tx, removal.model).delete({ where: removal.where });
      }
      // Table by table in TABLES order, so a row is written only after
      // everything it points at.
      for (const spec of TABLES) {
        for (const create of plan.creates.filter((c) => c.model === spec.model)) {
          await delegate(tx, spec.model).create({ data: create.data });
        }
        for (const update of plan.updates.filter((u) => u.model === spec.model)) {
          await delegate(tx, spec.model).update({ where: update.where, data: update.data });
        }
      }
    },
    { timeout: SYNC_TIMEOUT_MS, maxWait: SYNC_TIMEOUT_MS },
  );
}

/** Whether there's anything to write. */
export function hasChanges(plan: SyncPlan): boolean {
  return plan.creates.length + plan.updates.length + plan.linkRemovals.length > 0;
}

/** A value short enough for one report line, starting `from` characters in. */
function describe(value: unknown, from = 0): string {
  if (value === null) return "(empty)";
  const text = String(value).replace(/\s+/g, " ");
  const shown = (from > 0 ? "..." : "") + text.slice(from);
  return JSON.stringify(shown.length > 60 ? `${shown.slice(0, 57)}...` : shown);
}

/** One changed field. Long texts start just before where they differ, so an edit near the end still shows. */
function describeChange({ field, from, to }: FieldChange): string {
  if (typeof to === "object" && to !== null) return `${field}: changed`;
  let common = 0;
  if (typeof from === "string" && typeof to === "string") {
    const a = from.replace(/\s+/g, " ");
    const b = to.replace(/\s+/g, " ");
    while (common < a.length && a[common] === b[common]) common++;
  }
  const start = common > 40 ? common - 20 : 0;
  return `${field}: ${describe(from, start)} -> ${describe(to, start)}`;
}

/** The plan as the command prints it. */
export function formatPlan(plan: SyncPlan): string {
  const lines: string[] = [];
  for (const c of plan.creates) lines.push(`+ ${c.label} ${c.key}: new`);
  for (const u of plan.updates) {
    lines.push(`~ ${u.label} ${u.key}:`);
    for (const c of u.changes) lines.push(`    ${describeChange(c)}`);
  }
  for (const r of plan.linkRemovals) lines.push(`- ${r.label} ${r.key}: removed`);

  if (lines.length === 0) lines.push("No changes: the database already matches the file.");

  if (plan.notInFile.length > 0) {
    lines.push("", "In the database but not in the file (left as they are, never deleted):");
    for (const n of plan.notInFile) lines.push(`  ${n.label} ${n.key}`);
  }
  if (plan.warnings.length > 0) {
    lines.push("", "Warnings, these change results already given on the dashboard:");
    for (const w of plan.warnings) lines.push(`  ! ${w}`);
    lines.push("  (History is unaffected: it keeps its own copies.)");
  }
  return lines.join("\n");
}

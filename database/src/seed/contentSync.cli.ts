import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../db/prisma";
import { holdsOldFakeDataset, OLD_FAKE_DATASET_MESSAGE } from ".";
import {
  applyContentSync,
  formatPlan,
  hasChanges,
  loadAssessedSectionIds,
  loadCurrentContent,
  loadDeletedInEditor,
  newRowsOnly,
  planContentSync,
} from "./contentSync";

// `npm run content:sync [-- --apply] [--only-new] [--file <path>]`
//
// Makes the database match the WP2 dataset JSON file (see contentSync.ts) without
// restarting the app, it reads content from the database on every request.
// A dry run by default: prints what would change. --apply writes it.
//
// The database is the source of truth for content (the admin curriculum
// editor edits it), so applying a sync overwrites any edits made in the
// editor to rows that are in the file. Check the dry run first. --only-new
// only adds rows the database doesn't have yet (e.g. newly delivered items)
// and changes nothing that's there, nor re-adds what an admin deleted.
//
// In Docker, through the db-init service (its src/ is mounted, so this file
// and the data are live):
//   docker compose run --rm db-init npm run content:sync -- --apply
//   docker compose run --rm db-init npm run content:sync -- --only-new --apply

const DEFAULT_FILE = path.join(__dirname, "data", "aios_wp2_seed.json");

/**
 * The command's flags. Through npm they need a `--` first
 * (`npm run content:sync -- --apply`): without it npm takes them as its own
 * and drops them before they get here.
 */
function parseArgs(argv: string[]) {
  const valueOf = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    apply: argv.includes("--apply"),
    onlyNew: argv.includes("--only-new"),
    file: path.resolve(valueOf("--file") ?? DEFAULT_FILE),
  };
}

async function main() {
  const { apply, onlyNew, file } = parseArgs(process.argv.slice(2));

  // Same rule as the seed: never mix WP2 into the old test dataset.
  if (await holdsOldFakeDataset()) throw new Error(OLD_FAKE_DATASET_MESSAGE);

  // Read fresh from disk (not imported), so the latest edits are what's synced.
  const data: unknown = JSON.parse(readFileSync(file, "utf8"));
  const [current, assessed, deleted] = await Promise.all([
    loadCurrentContent(),
    loadAssessedSectionIds(),
    onlyNew ? loadDeletedInEditor() : Promise.resolve(new Set<string>()),
  ]);
  const onlyNewRows = onlyNew ? newRowsOnly(data, current, deleted) : null;
  const plan = planContentSync(onlyNewRows?.data ?? data, current, assessed);
  // Everything else is "not in the file" only because it was filtered out.
  if (onlyNew) plan.notInFile = [];

  const mode = onlyNew ? " (only new rows)" : "";
  console.log(`Content sync${mode}: ${path.relative(process.cwd(), file)} -> "wp2" database\n`);
  console.log(formatPlan(plan));
  if (onlyNewRows && onlyNewRows.skipped.length > 0) {
    console.log("\nNew in the file but left out, since a row they point at is gone:");
    for (const s of onlyNewRows.skipped) console.log(`  ${s.label} ${s.key}: ${s.reason}`);
  }
  console.log(
    onlyNew
      ? "\nOnly rows the database doesn't have are added; nothing changed in the curriculum editor is touched."
      : "\nNote: applying this overwrites any changes made in the curriculum editor to the rows listed above.",
  );

  if (!hasChanges(plan)) return;
  if (!apply) {
    console.log(
      "\nDry run: nothing was changed. To write these changes, run:\n" +
        `  npm run content:sync -- ${onlyNew ? "--only-new " : ""}--apply\n` +
        "(The -- matters: without it npm keeps --apply to itself and this stays a dry run.)",
    );
    return;
  }
  await applyContentSync(plan);
  console.log("\nApplied. The app shows the changes on the next page load.");
}

main()
  .catch((err: unknown) => {
    console.error(`\nContent sync failed, nothing was changed:\n${String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

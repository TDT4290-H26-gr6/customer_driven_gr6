import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../db/prisma";
import { otherDatasetsPresent } from ".";
import {
  applyContentSync,
  formatPlan,
  hasChanges,
  loadAssessedSectionIds,
  loadCurrentContent,
  planContentSync,
} from "./contentSync";

// `npm run content:sync [-- --apply] [--file <path>]`
//
// Makes the database match the WP2 dataset JSON file (see contentSync.ts) without
// restarting the app — it reads content from the database on every request.
// A dry run by default: prints what would change. --apply writes it.
//
// In Docker, through the db-init service (its src/ is mounted, so this file
// and the data are live):
//   docker compose run --rm db-init npm run content:sync -- --apply

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
    file: path.resolve(valueOf("--file") ?? DEFAULT_FILE),
  };
}

async function main() {
  const { apply, file } = parseArgs(process.argv.slice(2));

  // Same rule as the seed: two datasets never share a database.
  const conflicting = await otherDatasetsPresent("wp2");
  if (conflicting.length > 0) {
    throw new Error(
      `The database holds the "${conflicting.join(", ")}" dataset, not "wp2". Nothing was changed.`,
    );
  }

  // Read fresh from disk (not imported), so the latest edits are what's synced.
  const data: unknown = JSON.parse(readFileSync(file, "utf8"));
  const [current, assessed] = await Promise.all([loadCurrentContent(), loadAssessedSectionIds()]);
  const plan = planContentSync(data, current, assessed);

  console.log(`Content sync: ${path.relative(process.cwd(), file)} -> "wp2" database\n`);
  console.log(formatPlan(plan));

  if (!hasChanges(plan)) return;
  if (!apply) {
    console.log(
      "\nDry run: nothing was changed. To write these changes, run:\n" +
        "  npm run content:sync -- --apply\n" +
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

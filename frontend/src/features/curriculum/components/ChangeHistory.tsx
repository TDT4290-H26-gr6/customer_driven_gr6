import { APP_LOCALE } from "@/shared/lib/format";
import type { ChangeAction, ChangeMark, History } from "../types";
import styles from "../pages/CurriculumPage.module.css";

const DATE_TIME = new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: "medium", timeStyle: "short" });

/** How the editor names each change ("retired" is "Removed" everywhere else here). */
const VERB: Record<ChangeAction, string> = {
  created: "Added",
  edited: "Edited",
  retired: "Removed",
  restored: "Restored",
  deleted: "Deleted",
};

function Mark({ verb, mark }: { verb: string; mark: ChangeMark }) {
  return (
    <span>
      {verb} by {mark.by}, <time dateTime={mark.at}>{DATE_TIME.format(new Date(mark.at))}</time>
    </span>
  );
}

/**
 * Who added an item and who changed it last, and when, from the change log.
 * Nothing for an item loaded from the dataset that nobody has changed since.
 * The full log, with the values before and after each change, is the
 * change log download.
 */
export function ChangeHistory({ history }: { history: History }) {
  const { created, lastChange } = history;
  if (!created && !lastChange) return null;
  return (
    <p className={styles.history}>
      {created && <Mark verb="Added" mark={created} />}
      {created && lastChange && " · "}
      {lastChange && <Mark verb={VERB[lastChange.action]} mark={lastChange} />}
    </p>
  );
}

import { deleteDuePersonalData } from "./identity.service";

/** How often the backend looks for accounts whose 30 days are up. */
export const DELETION_JOB_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Deletes the personal data of accounts whose deletion is due: once at
 * startup (catching up on any that fell due while the backend was down),
 * then every hour. So the data goes within an hour of its date. Returns a
 * function that stops the timer, for shutdown.
 */
export function startDeletionJob(intervalMs = DELETION_JOB_INTERVAL_MS) {
  const run = () => {
    deleteDuePersonalData()
      .then((count) => {
        if (count > 0) console.log(`Deleted the personal data of ${count} account(s).`);
      })
      .catch((err) => console.error("Deletion job failed:", err));
  };

  run();
  // unref: a pending run never keeps the process alive on shutdown.
  const timer = setInterval(run, intervalMs).unref();
  return () => clearInterval(timer);
}

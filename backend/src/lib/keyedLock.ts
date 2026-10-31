/**
 * Runs async work one at a time per key: a second call for the same key
 * waits until the first has settled; different keys run in parallel. Used
 * to close check-then-insert races (read, decide, write) for one learner.
 *
 * In-process only, correct while the backend runs as a single instance,
 * which is how it's deployed. Several instances would need a database lock.
 */
export function createKeyedLock() {
  const tails = new Map<string, Promise<unknown>>();

  return function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    const run = previous.then(fn);
    // The next caller waits for this one whether it succeeds or fails.
    const tail = run.catch(() => undefined);
    tails.set(key, tail);
    void tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return run;
  };
}

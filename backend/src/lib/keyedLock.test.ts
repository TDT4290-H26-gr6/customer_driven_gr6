import { describe, expect, it } from "vitest";
import { createKeyedLock } from "./keyedLock";

/** A promise plus the function that resolves it, to control timing by hand. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("createKeyedLock", () => {
  it("runs calls for the same key one after another", async () => {
    const runExclusive = createKeyedLock();
    const order: string[] = [];
    const firstGate = deferred();

    const first = runExclusive("learner-1", async () => {
      order.push("first start");
      await firstGate.promise;
      order.push("first end");
    });
    const second = runExclusive("learner-1", async () => {
      order.push("second start");
    });

    await Promise.resolve();
    expect(order).toEqual(["first start"]); // second is waiting

    firstGate.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual(["first start", "first end", "second start"]);
  });

  it("runs calls for different keys in parallel", async () => {
    const runExclusive = createKeyedLock();
    const order: string[] = [];
    const gate = deferred();

    const a = runExclusive("learner-1", async () => {
      order.push("a start");
      await gate.promise;
    });
    const b = runExclusive("learner-2", async () => {
      order.push("b start");
    });

    await b;
    expect(order).toEqual(["a start", "b start"]); // b didn't wait for a
    gate.resolve();
    await a;
  });

  it("still runs the next call after one fails, and passes the failure to its own caller", async () => {
    const runExclusive = createKeyedLock();

    const failing = runExclusive("learner-1", async () => {
      throw new Error("db down");
    });
    const next = runExclusive("learner-1", async () => "ok");

    await expect(failing).rejects.toThrow("db down");
    await expect(next).resolves.toBe("ok");
  });
});

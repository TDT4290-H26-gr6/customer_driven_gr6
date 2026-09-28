import { describe, expect, it, vi } from "vitest";
import { isTransientError, withRetry } from "./retry";

const networkError = { status: 0, message: "offline" };
const serverError = { status: 503, message: "unavailable" };
const clientError = { status: 404, message: "Unknown question" };

describe("isTransientError", () => {
  it("treats network failures and 5xx as transient", () => {
    expect(isTransientError(networkError)).toBe(true);
    expect(isTransientError(serverError)).toBe(true);
  });

  it("treats 4xx and non-ApiErrors as permanent", () => {
    expect(isTransientError(clientError)).toBe(false);
    expect(isTransientError(new Error("bug"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("retries a transient failure and returns the eventual result", async () => {
    const fn = vi.fn().mockRejectedValueOnce(networkError).mockResolvedValue("ok");

    await expect(withRetry(fn, { delayMs: 0 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("doesn't retry a 4xx", async () => {
    const fn = vi.fn().mockRejectedValue(clientError);

    await expect(withRetry(fn, { delayMs: 0 })).rejects.toBe(clientError);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("gives up after the given number of attempts and rethrows the last error", async () => {
    const fn = vi.fn().mockRejectedValue(serverError);

    await expect(withRetry(fn, { attempts: 3, delayMs: 0 })).rejects.toBe(serverError);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

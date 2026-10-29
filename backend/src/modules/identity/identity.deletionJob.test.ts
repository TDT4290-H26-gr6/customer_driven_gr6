import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startDeletionJob } from "./identity.deletionJob";
import { deleteDuePersonalData } from "./identity.service";

vi.mock("./identity.service");

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  vi.mocked(deleteDuePersonalData).mockResolvedValue(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startDeletionJob", () => {
  it("runs once at startup, then on every interval until stopped", async () => {
    const stop = startDeletionJob(1000);
    expect(deleteDuePersonalData).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(deleteDuePersonalData).toHaveBeenCalledTimes(3);

    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(deleteDuePersonalData).toHaveBeenCalledTimes(3);
  });

  it("logs how many accounts it deleted", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(deleteDuePersonalData).mockResolvedValue(2);

    const stop = startDeletionJob(1000);
    await vi.advanceTimersByTimeAsync(0);
    stop();

    expect(log).toHaveBeenCalledWith("Deleted the personal data of 2 account(s).");
  });

  it("logs a failed run instead of crashing, and tries again next time", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(deleteDuePersonalData).mockRejectedValueOnce(new Error("db down"));

    const stop = startDeletionJob(1000);
    await vi.advanceTimersByTimeAsync(1000);
    stop();

    expect(error).toHaveBeenCalledWith("Deletion job failed:", expect.any(Error));
    expect(deleteDuePersonalData).toHaveBeenCalledTimes(2);
  });
});

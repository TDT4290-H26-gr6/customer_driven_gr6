import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/shared/api/client";
import { getAdvice } from "./api";

vi.mock("@/shared/api/client", () => ({ apiFetch: vi.fn() }));

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

it("getAdvice waits longer than usual, since the AI can take a while", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce({ summary: "Well done" });
  expect(await getAdvice()).toEqual({ summary: "Well done" });
  expect(apiFetch).toHaveBeenCalledWith("/advice", { timeoutMs: 60_000 });
});

it("getAdvice is null when there's no advice to give (204)", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(undefined);
  expect(await getAdvice()).toBeNull();
});

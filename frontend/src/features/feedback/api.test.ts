import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/shared/api/client";
import { getAllFeedback, sendFeedback } from "./api";

vi.mock("@/shared/api/client", () => ({ apiFetch: vi.fn() }));

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

it("sendFeedback posts the feedback", async () => {
  const input = { message: "Hard to read", suggestion: null, page: "/dashboard", rating: 4 };
  await sendFeedback(input);
  expect(apiFetch).toHaveBeenCalledWith("/feedback", { method: "POST", body: input });
});

it("getAllFeedback fetches every piece of feedback for admins", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce([]);
  expect(await getAllFeedback()).toEqual([]);
  expect(apiFetch).toHaveBeenCalledWith("/admin/feedback");
});

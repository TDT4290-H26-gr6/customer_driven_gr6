import { expect, it, vi } from "vitest";
import { apiFetch } from "@/shared/api/client";
import { getSatHistory } from "./api";

vi.mock("@/shared/api/client", () => ({ apiFetch: vi.fn() }));

it("getSatHistory fetches every completed assessment", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce([]);
  expect(await getSatHistory()).toEqual([]);
  expect(apiFetch).toHaveBeenCalledWith("/assessment/history");
});

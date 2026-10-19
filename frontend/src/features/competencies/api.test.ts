import { expect, it, vi } from "vitest";
import { apiFetch } from "@/shared/api/client";
import { getCompetencies } from "./api";

vi.mock("@/shared/api/client", () => ({ apiFetch: vi.fn() }));

it("getCompetencies fetches the Competencies tab's data", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce({ sections: [] });
  expect(await getCompetencies()).toEqual({ sections: [] });
  expect(apiFetch).toHaveBeenCalledWith("/competencies");
});

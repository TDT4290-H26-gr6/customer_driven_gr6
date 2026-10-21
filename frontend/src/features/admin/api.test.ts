import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/shared/api/client";
import { downloadBlob } from "@/shared/lib/download";
import {
  downloadQuestionsCsv,
  downloadTestsCsv,
  getVisibility,
  setCompetenceGrant,
  setSectionGrant,
} from "./api";

vi.mock("@/shared/api/client", () => ({ apiFetch: vi.fn() }));
vi.mock("@/shared/lib/download", () => ({ downloadBlob: vi.fn() }));

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(downloadBlob).mockReset();
});

describe("admin api", () => {
  it("getVisibility fetches the role × section matrix", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ roles: [] });
    expect(await getVisibility()).toEqual({ roles: [] });
    expect(apiFetch).toHaveBeenCalledWith("/admin/visibility");
  });

  it("setSectionGrant grants with PUT and revokes with DELETE", async () => {
    await setSectionGrant("role 1", "sec/1", true);
    await setSectionGrant("role 1", "sec/1", false);
    // Ids are escaped so they can't change the path.
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/admin/roles/role%201/sections/sec%2F1", {
      method: "PUT",
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/admin/roles/role%201/sections/sec%2F1", {
      method: "DELETE",
    });
  });

  it("setCompetenceGrant grants with PUT and revokes with DELETE", async () => {
    await setCompetenceGrant("role-1", "c-1", true);
    await setCompetenceGrant("role-1", "c-1", false);
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/admin/roles/role-1/competences/c-1", {
      method: "PUT",
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/admin/roles/role-1/competences/c-1", {
      method: "DELETE",
    });
  });

  it.each([
    [downloadTestsCsv, "/admin/stats/tests.csv", "aios-tests.csv"],
    [downloadQuestionsCsv, "/admin/stats/questions.csv", "aios-question-times.csv"],
  ])("downloads a CSV export as a file", async (download, path, fileName) => {
    const blob = new Blob(["a,b"]);
    vi.mocked(apiFetch).mockResolvedValueOnce(blob);

    await download();

    expect(apiFetch).toHaveBeenCalledWith(path, { responseType: "blob" });
    expect(downloadBlob).toHaveBeenCalledWith(blob, fileName);
  });
});

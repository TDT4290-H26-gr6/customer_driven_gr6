import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/shared/api/client";
import { downloadBlob } from "@/shared/lib/download";
import { downloadQuestionsCsv, downloadTestsCsv, getDropoff, getVisibility } from "./api";

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

  it("getDropoff sends the filters, with the end date inclusive", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ questions: [] });

    await getDropoff({
      type: "targeted_reevaluation",
      sectionId: "s 1",
      from: "2026-10-01",
      to: "2026-10-31",
      inactiveDays: 14,
    });

    const url = new URL(String(vi.mocked(apiFetch).mock.calls[0][0]), "http://x");
    expect(url.pathname).toBe("/admin/sat/dropoff");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      type: "targeted_reevaluation",
      inactiveDays: "14",
      sectionId: "s 1",
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-10-31T23:59:59.999Z",
    });
  });

  it("getDropoff omits empty optional filters", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ questions: [] });
    await getDropoff({ type: "initial", sectionId: "", from: "", to: "", inactiveDays: 7 });
    expect(apiFetch).toHaveBeenCalledWith("/admin/sat/dropoff?type=initial&inactiveDays=7");
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

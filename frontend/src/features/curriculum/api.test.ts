import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/shared/api/client";
import { downloadBlob } from "@/shared/lib/download";
import * as api from "./api";

vi.mock("@/shared/api/client", () => ({ apiFetch: vi.fn() }));
vi.mock("@/shared/lib/download", () => ({ downloadBlob: vi.fn() }));

const input = {
  questionType: "likert" as const,
  prompt: "How confident are you?",
  sectionModuleId: "m 1",
  competenceId: "c-1",
  content: { scale: { min: 1, max: 5 } },
};

beforeEach(() => {
  vi.mocked(apiFetch).mockReset().mockResolvedValue(undefined);
  vi.mocked(downloadBlob).mockReset();
});

it.each([
  [() => api.getCurriculum(), "/admin/curriculum", undefined],
  [() => api.getQuestion("q/1"), "/admin/curriculum/questions/q%2F1", undefined],
  [() => api.createQuestion(input), "/admin/curriculum/questions", { method: "POST", body: input }],
  [
    () => api.updateQuestion("q-1", input),
    "/admin/curriculum/questions/q-1",
    { method: "PUT", body: input },
  ],
  [() => api.removeQuestion("q-1"), "/admin/curriculum/questions/q-1", { method: "DELETE" }],
  [() => api.restoreQuestion("q-1"), "/admin/curriculum/questions/q-1/restore", { method: "POST" }],
  [
    () => api.previewQuestion(input),
    "/admin/curriculum/questions/preview",
    { method: "POST", body: input },
  ],
  [
    () => api.createCompetence({ name: "X", description: null }),
    "/admin/curriculum/competences",
    { method: "POST", body: { name: "X", description: null } },
  ],
  [
    () => api.updateCompetence("c-1", { name: "X", description: null }),
    "/admin/curriculum/competences/c-1",
    { method: "PUT", body: { name: "X", description: null } },
  ],
])("calls the right endpoint (%#)", async (call, path, options) => {
  await call();
  if (options) expect(apiFetch).toHaveBeenCalledWith(path, options);
  else expect(apiFetch).toHaveBeenCalledWith(path);
});

it.each([
  ["sections", api.sectionsApi, "/admin/curriculum/sections"],
  ["modules", api.modulesApi, "/admin/curriculum/modules"],
  ["journeys", api.journeysApi, "/admin/curriculum/journeys"],
] as const)("%s: create, update, remove and restore", async (_name, resource, base) => {
  const body = { name: "X" } as never;
  await resource.create(body);
  expect(apiFetch).toHaveBeenLastCalledWith(base, { method: "POST", body });
  await resource.update("a b", body);
  expect(apiFetch).toHaveBeenLastCalledWith(`${base}/a%20b`, { method: "PUT", body });
  await resource.remove("x");
  expect(apiFetch).toHaveBeenLastCalledWith(`${base}/x`, { method: "DELETE" });
  await resource.restore("x");
  expect(apiFetch).toHaveBeenLastCalledWith(`${base}/x/restore`, { method: "POST" });
});

it.each([
  [
    () => api.downloadCurriculum(),
    "/admin/curriculum/export.json",
    /^aios-curriculum-\d{4}-\d{2}-\d{2}\.json$/,
  ],
  [
    () => api.downloadChangeLog(),
    "/admin/curriculum/changelog.csv",
    /^aios-curriculum-changelog\.csv$/,
  ],
])("downloads %#: the curriculum file, then the change log", async (download, path, fileName) => {
  const blob = new Blob(["{}"]);
  vi.mocked(apiFetch).mockResolvedValueOnce(blob);
  await download();
  expect(apiFetch).toHaveBeenCalledWith(path, { responseType: "blob" });
  expect(downloadBlob).toHaveBeenCalledWith(blob, expect.stringMatching(fileName));
});

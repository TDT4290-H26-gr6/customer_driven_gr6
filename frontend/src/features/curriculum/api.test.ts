import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/shared/api/client";
import * as api from "./api";

vi.mock("@/shared/api/client", () => ({ apiFetch: vi.fn() }));

const input = {
  questionType: "likert" as const,
  prompt: "How confident are you?",
  sectionModuleId: "m 1",
  competenceId: "c-1",
  content: { scale: { min: 1, max: 5 } },
};

beforeEach(() => {
  vi.mocked(apiFetch).mockReset().mockResolvedValue(undefined);
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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/shared/api/client";
import {
  completeAssessment,
  discardAssessment,
  getAssessableSections,
  getAssessmentPath,
  getProgress,
  saveResponse,
  startReassessment,
} from "./api";

vi.mock("@/shared/api/client", () => ({ apiFetch: vi.fn() }));

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("assessment api", () => {
  it("getAssessmentPath fetches the adaptive path", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ answered: [], next: null });
    expect(await getAssessmentPath()).toEqual({ answered: [], next: null });
    expect(apiFetch).toHaveBeenCalledWith("/assessment/path");
  });

  it("getProgress returns the attempt in progress, or null when there's none (204)", async () => {
    const progress = { satInstanceId: "sat-1", journey: null, responses: [] };
    vi.mocked(apiFetch).mockResolvedValueOnce(progress);
    expect(await getProgress()).toEqual(progress);

    vi.mocked(apiFetch).mockResolvedValueOnce(undefined);
    expect(await getProgress()).toBeNull();
    expect(apiFetch).toHaveBeenCalledWith("/assessment/progress");
  });

  it("getAssessableSections fetches the sections a reassessment can cover", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([]);
    await getAssessableSections();
    expect(apiFetch).toHaveBeenCalledWith("/assessment/sections");
  });

  it("startReassessment posts the chosen sections", async () => {
    await startReassessment(["s1", "s2"]);
    expect(apiFetch).toHaveBeenCalledWith("/assessment/start", {
      method: "POST",
      body: { sectionIds: ["s1", "s2"] },
    });
  });

  it("saveResponse posts the answer and the time spent", async () => {
    const answer = { session: { value: ["a"] }, complete: true };
    await saveResponse("q1", answer, 4200);
    expect(apiFetch).toHaveBeenCalledWith("/assessment/responses", {
      method: "POST",
      body: { questionId: "q1", answer, timeSpentMs: 4200 },
    });
  });

  it("discardAssessment deletes the attempt in progress", async () => {
    await discardAssessment();
    expect(apiFetch).toHaveBeenCalledWith("/assessment/active", { method: "DELETE" });
  });

  it("completeAssessment finishes the attempt", async () => {
    await completeAssessment();
    expect(apiFetch).toHaveBeenCalledWith("/assessment/complete", { method: "POST" });
  });
});

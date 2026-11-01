import { beforeEach, describe, expect, it, vi } from "vitest";
import { learner, learnerWithProfile } from "../../test/fixtures";
import { tokenFor, useTestServer } from "../../test/httpTestServer";
import { findLearnerById } from "../identity/identity.service";
import * as assessment from "./assessment.service";

vi.mock("../identity/identity.service");
vi.mock("./assessment.service");

const api = useTestServer();
const token = tokenFor("learner-1");

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findLearnerById).mockResolvedValue(learnerWithProfile());
});

// The read-only routes hand the learner's id to one service function and
// return its result as JSON.
describe.each([
  ["/questions", "listQuestions"],
  ["/assessment/path", "getAssessmentPath"],
  ["/assessment/progress", "getProgress"],
  ["/assessment/sections", "listAssessableSections"],
  ["/competence-scores", "getLatestCompetenceScores"],
  ["/assessment/history", "getSatHistory"],
  ["/competencies", "getCompetencies"],
] as const)("GET %s", (path, serviceFn) => {
  it("returns the service's result for the signed-in learner", async () => {
    vi.mocked(assessment[serviceFn]).mockResolvedValue({ from: serviceFn } as never);

    const res = await api.request("GET", path, { token });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ from: serviceFn });
    expect(assessment[serviceFn]).toHaveBeenCalledWith("learner-1");
  });

  it("needs a session", async () => {
    expect((await api.request("GET", path)).status).toBe(401);
    expect(assessment[serviceFn]).not.toHaveBeenCalled();
  });

  it("is 401 for a deleted account", async () => {
    vi.mocked(findLearnerById).mockResolvedValue(null);
    expect((await api.request("GET", path, { token })).status).toBe(401);
  });
});

describe("POST /assessment/views", () => {
  const body = { questionId: "q1" };

  it("records the view and answers 204", async () => {
    vi.mocked(assessment.recordQuestionView).mockResolvedValue(true);

    const res = await api.request("POST", "/assessment/views", { token, body });

    expect(res.status).toBe(204);
    expect(assessment.recordQuestionView).toHaveBeenCalledWith("learner-1", "q1");
  });

  it("is 404 for an unknown question", async () => {
    vi.mocked(assessment.recordQuestionView).mockResolvedValue(false);
    expect((await api.request("POST", "/assessment/views", { token, body })).status).toBe(404);
  });

  it("is 400 without a question", async () => {
    expect((await api.request("POST", "/assessment/views", { token, body: {} })).status).toBe(400);
    expect(assessment.recordQuestionView).not.toHaveBeenCalled();
  });

  it("needs a session and a complete profile", async () => {
    expect((await api.request("POST", "/assessment/views", { body })).status).toBe(401);
    vi.mocked(findLearnerById).mockResolvedValue(learner());
    expect((await api.request("POST", "/assessment/views", { token, body })).status).toBe(403);
    expect(assessment.recordQuestionView).not.toHaveBeenCalled();
  });
});

describe("POST /assessment/responses", () => {
  const body = { questionId: "q1", answer: { session: {}, complete: true }, timeSpentMs: 4200 };

  it("saves the answer with its time on task", async () => {
    vi.mocked(assessment.saveResponse).mockResolvedValue(true as never);

    const res = await api.request("POST", "/assessment/responses", { token, body });

    expect(res.status).toBe(204);
    expect(assessment.saveResponse).toHaveBeenCalledWith("learner-1", "q1", body.answer, 4200);
  });

  it("drops an implausible time instead of failing the save", async () => {
    vi.mocked(assessment.saveResponse).mockResolvedValue(true as never);
    await api.request("POST", "/assessment/responses", {
      token,
      body: { ...body, timeSpentMs: 5 * 60 * 60 * 1000 },
    });
    expect(assessment.saveResponse).toHaveBeenCalledWith("learner-1", "q1", body.answer, undefined);
  });

  it("is 400 without a question or answer", async () => {
    const noQuestion = await api.request("POST", "/assessment/responses", {
      token,
      body: { answer: {} },
    });
    const noAnswer = await api.request("POST", "/assessment/responses", {
      token,
      body: { questionId: "q1", answer: "yes" },
    });
    expect([noQuestion.status, noAnswer.status]).toEqual([400, 400]);
    expect(assessment.saveResponse).not.toHaveBeenCalled();
  });

  it("is 403 until the profile is complete", async () => {
    vi.mocked(findLearnerById).mockResolvedValue(learner());
    const res = await api.request("POST", "/assessment/responses", { token, body });
    expect(res.status).toBe(403);
    expect(assessment.saveResponse).not.toHaveBeenCalled();
  });

  it("is 404 for an unknown question", async () => {
    vi.mocked(assessment.saveResponse).mockResolvedValue(false as never);
    const res = await api.request("POST", "/assessment/responses", { token, body });
    expect(res.status).toBe(404);
  });
});

describe("POST /assessment/start", () => {
  it("starts a reassessment of the chosen sections", async () => {
    vi.mocked(assessment.startReassessment).mockResolvedValue({ ok: true } as never);

    const res = await api.request("POST", "/assessment/start", {
      token,
      body: { sectionIds: ["s1", "s2"] },
    });

    expect(res.status).toBe(204);
    expect(assessment.startReassessment).toHaveBeenCalledWith("learner-1", ["s1", "s2"]);
  });

  it("passes on the service's refusal", async () => {
    vi.mocked(assessment.startReassessment).mockResolvedValue({
      ok: false,
      status: 409,
      error: "An assessment is already in progress",
    } as never);

    const res = await api.request("POST", "/assessment/start", {
      token,
      body: { sectionIds: ["s1"] },
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "An assessment is already in progress" });
  });

  it("is 400 without sections and 403 without a complete profile", async () => {
    const empty = await api.request("POST", "/assessment/start", {
      token,
      body: { sectionIds: [] },
    });
    expect(empty.status).toBe(400);

    vi.mocked(findLearnerById).mockResolvedValue(learner());
    const noProfile = await api.request("POST", "/assessment/start", {
      token,
      body: { sectionIds: ["s1"] },
    });
    expect(noProfile.status).toBe(403);
    expect(assessment.startReassessment).not.toHaveBeenCalled();
  });
});

describe("POST /assessment/journey", () => {
  it("starts an assessment of one learning journey", async () => {
    vi.mocked(assessment.startJourneyAssessment).mockResolvedValue({ ok: true } as never);

    const res = await api.request("POST", "/assessment/journey", {
      token,
      body: { journeyId: "lj-1" },
    });

    expect(res.status).toBe(204);
    expect(assessment.startJourneyAssessment).toHaveBeenCalledWith("learner-1", "lj-1");
  });

  it("passes on the service's refusal", async () => {
    vi.mocked(assessment.startJourneyAssessment).mockResolvedValue({
      ok: false,
      status: 404,
      error: "Unknown journey",
    } as never);
    const res = await api.request("POST", "/assessment/journey", {
      token,
      body: { journeyId: "nope" },
    });
    expect(res.status).toBe(404);
  });

  it("is 400 without a journey and 403 without a complete profile", async () => {
    expect((await api.request("POST", "/assessment/journey", { token, body: {} })).status).toBe(
      400,
    );
    vi.mocked(findLearnerById).mockResolvedValue(learner());
    const res = await api.request("POST", "/assessment/journey", {
      token,
      body: { journeyId: "lj-1" },
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /assessment/complete", () => {
  it.each(["completed", "none"])("is 204 when the service says %s", async (outcome) => {
    vi.mocked(assessment.completeActiveInstance).mockResolvedValue(outcome as never);
    expect((await api.request("POST", "/assessment/complete", { token })).status).toBe(204);
  });

  it("is 409 while questions are still unanswered", async () => {
    vi.mocked(assessment.completeActiveInstance).mockResolvedValue("unfinished" as never);
    expect((await api.request("POST", "/assessment/complete", { token })).status).toBe(409);
  });
});

it("DELETE /assessment/active discards the attempt in progress", async () => {
  const res = await api.request("DELETE", "/assessment/active", { token });
  expect(res.status).toBe(204);
  expect(assessment.discardActiveInstance).toHaveBeenCalledWith("learner-1");
});

describe("GET /competence-scores/by-section", () => {
  it("returns the latest assessment by default", async () => {
    vi.mocked(assessment.getAttemptSectionScores).mockResolvedValue({ sections: [] } as never);

    const res = await api.request("GET", "/competence-scores/by-section", { token });

    expect(res.status).toBe(200);
    expect(assessment.getAttemptSectionScores).toHaveBeenCalledWith("learner-1", undefined);
  });

  it("returns an earlier assessment with ?instance", async () => {
    vi.mocked(assessment.getAttemptSectionScores).mockResolvedValue({ sections: [] } as never);
    await api.request("GET", "/competence-scores/by-section?instance=2", { token });
    expect(assessment.getAttemptSectionScores).toHaveBeenCalledWith("learner-1", 2);
  });

  it.each(["0", "-1", "1.5", "abc"])("is 400 for ?instance=%s", async (instance) => {
    const res = await api.request("GET", `/competence-scores/by-section?instance=${instance}`, {
      token,
    });
    expect(res.status).toBe(400);
  });

  it("is 204 before any completed assessment and 404 for an unknown one", async () => {
    vi.mocked(assessment.getAttemptSectionScores).mockResolvedValue(null as never);
    expect((await api.request("GET", "/competence-scores/by-section", { token })).status).toBe(204);
    expect(
      (await api.request("GET", "/competence-scores/by-section?instance=9", { token })).status,
    ).toBe(404);
  });
});

describe("GET /competence-scores/progress", () => {
  it("returns the before/after progress", async () => {
    vi.mocked(assessment.getDashboardProgress).mockResolvedValue({ latest: {} } as never);
    const res = await api.request("GET", "/competence-scores/progress", { token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ latest: {} });
  });

  it("is 204 before any completed assessment", async () => {
    vi.mocked(assessment.getDashboardProgress).mockResolvedValue(null as never);
    expect((await api.request("GET", "/competence-scores/progress", { token })).status).toBe(204);
  });
});

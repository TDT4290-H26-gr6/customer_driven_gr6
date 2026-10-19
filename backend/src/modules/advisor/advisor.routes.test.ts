import { beforeEach, describe, expect, it, vi } from "vitest";
import { learner } from "../../test/fixtures";
import { tokenFor, useTestServer } from "../../test/httpTestServer";
import { findLearnerById } from "../identity/identity.service";
import { findJourney } from "../learningJourney/learningJourney.service";
import { getOrCreateAdvice } from "./advisor.service";

vi.mock("../identity/identity.service");
vi.mock("../learningJourney/learningJourney.service");
vi.mock("./advisor.service");

const api = useTestServer();
const token = tokenFor("learner-1");

const journey = (id: string) => ({
  id,
  name: `Journey ${id}`,
  description: "About data",
  moodleUrl: `https://moodle.example.org/${id}`,
  internalNote: "not sent to the browser",
  modules: [{ id: `${id}-m1`, order: 1, title: "Step one", description: null, extra: true }],
});

const advice = {
  id: "advice-1",
  satInstanceId: "sat-1",
  summary: "You're strong on FAIR data.",
  steps: [{ kind: "module", id: "m1", title: "Metadata", url: null, reason: "Your weakest area" }],
  journeyId: "lj-1",
  journeyReason: "Fits a data steward",
  runnerUpJourneyId: "lj-2",
  runnerUpJourneyReason: null,
  model: "gpt-oss-120b",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findLearnerById).mockResolvedValue(learner());
  vi.mocked(findJourney).mockImplementation(((id: string) =>
    Promise.resolve(journey(id))) as never);
});

describe("GET /advice", () => {
  it("returns the advice with both ranked journeys, best first", async () => {
    vi.mocked(getOrCreateAdvice).mockResolvedValue(advice as never);

    const res = await api.request("GET", "/advice", { token });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      summary: "You're strong on FAIR data.",
      steps: [{ kind: "module", title: "Metadata", url: null, reason: "Your weakest area" }],
      journeys: [
        {
          journey: {
            id: "lj-1",
            name: "Journey lj-1",
            description: "About data",
            moodleUrl: "https://moodle.example.org/lj-1",
            modules: [{ id: "lj-1-m1", order: 1, title: "Step one", description: null }],
          },
          reason: "Fits a data steward",
        },
        { journey: expect.objectContaining({ id: "lj-2" }), reason: null },
      ],
      model: "gpt-oss-120b",
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("leaves out ranked journeys that no longer exist", async () => {
    vi.mocked(getOrCreateAdvice).mockResolvedValue({ ...advice, runnerUpJourneyId: null } as never);
    vi.mocked(findJourney).mockResolvedValue(null);

    const res = await api.request("GET", "/advice", { token });

    expect(res.status).toBe(200);
    expect((res.body as { journeys: unknown[] }).journeys).toEqual([]);
  });

  it("is 204 when there's no advice to give", async () => {
    vi.mocked(getOrCreateAdvice).mockResolvedValue(null);
    expect((await api.request("GET", "/advice", { token })).status).toBe(204);
  });

  it("is 503 when the AI can't be reached", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(getOrCreateAdvice).mockRejectedValue(new Error("LLM timeout"));
    const res = await api.request("GET", "/advice", { token });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "AI advice is unavailable right now" });
  });

  it("needs a session and an existing account", async () => {
    expect((await api.request("GET", "/advice")).status).toBe(401);
    vi.mocked(findLearnerById).mockResolvedValue(null);
    expect((await api.request("GET", "/advice", { token })).status).toBe(401);
    expect(getOrCreateAdvice).not.toHaveBeenCalled();
  });
});

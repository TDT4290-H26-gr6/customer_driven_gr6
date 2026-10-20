import { beforeEach, describe, expect, it, vi } from "vitest";
import { learner } from "../../test/fixtures";
import { tokenFor, useTestServer } from "../../test/httpTestServer";
import { findLearnerById } from "../identity/identity.service";
import * as journeys from "./learningJourney.service";

vi.mock("../identity/identity.service");
vi.mock("./learningJourney.service");

const api = useTestServer();
const token = tokenFor("learner-1");

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findLearnerById).mockResolvedValue(learner());
});

describe("GET /learning-journeys", () => {
  it("lists every journey", async () => {
    vi.mocked(journeys.listJourneys).mockResolvedValue([{ id: "lj-1" }] as never);
    const res = await api.request("GET", "/learning-journeys", { token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: "lj-1" }]);
  });

  it("needs a session and an existing account", async () => {
    expect((await api.request("GET", "/learning-journeys")).status).toBe(401);
    vi.mocked(findLearnerById).mockResolvedValue(null);
    expect((await api.request("GET", "/learning-journeys", { token })).status).toBe(401);
  });
});

// Each returns the learner's pick, or 204 when there's nothing to show.
describe.each([
  ["/learning-journeys/recommendation", "recommendJourney"],
  ["/learning-journeys/recommendations", "recommendJourneys"],
  ["/learning-journeys/suggestion", "suggestJourney"],
] as const)("GET %s", (path, serviceFn) => {
  it("returns the result for the signed-in learner", async () => {
    vi.mocked(journeys[serviceFn]).mockResolvedValue({ id: "lj-1" } as never);
    const res = await api.request("GET", path, { token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "lj-1" });
    expect(journeys[serviceFn]).toHaveBeenCalledWith("learner-1");
  });

  it("is 204 when there's nothing to recommend", async () => {
    vi.mocked(journeys[serviceFn]).mockResolvedValue(null as never);
    const res = await api.request("GET", path, { token });
    expect(res.status).toBe(204);
    expect(res.body).toBeUndefined();
  });
});

it("GET /learning-journeys/weak-competences returns the weak competences", async () => {
  vi.mocked(journeys.weakCompetences).mockResolvedValue([] as never);
  const res = await api.request("GET", "/learning-journeys/weak-competences", { token });
  expect(res.status).toBe(200);
  expect(res.body).toEqual([]);
  expect(journeys.weakCompetences).toHaveBeenCalledWith("learner-1");
});

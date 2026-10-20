import { beforeEach, describe, expect, it, vi } from "vitest";
import { learner } from "../../test/fixtures";
import { tokenFor, useTestServer } from "../../test/httpTestServer";
import { isAdminEmail } from "../identity/identity.admin";
import { findLearnerById } from "../identity/identity.service";
import { listQuestionRows, listTestRows } from "./stats.service";

vi.mock("../identity/identity.service");
vi.mock("../identity/identity.admin");
vi.mock("./stats.service");

const api = useTestServer();
const token = tokenFor("learner-1");

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findLearnerById).mockResolvedValue(learner());
  vi.mocked(isAdminEmail).mockReturnValue(true);
});

describe("GET /admin/stats/tests.csv", () => {
  it("downloads one row per completed assessment as CSV", async () => {
    vi.mocked(listTestRows).mockResolvedValue([
      { satInstanceId: "sat-1", role: "Data steward", score: 7, maxScore: 10 },
    ] as never);

    const res = await api.request("GET", "/admin/stats/tests.csv", { token });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("aios-tests.csv");
    const [header, row] = (res.body as string).trim().split(/\r?\n/);
    expect(header.split(",")[0]).toBe("satInstanceId");
    expect(row).toContain("sat-1");
    expect(row).toContain("Data steward");
  });
});

describe("GET /admin/stats/questions.csv", () => {
  it("downloads one row per answered question as CSV", async () => {
    vi.mocked(listQuestionRows).mockResolvedValue([
      { satInstanceId: "sat-1", competence: "FAIR data", timeSpentMs: 4200 },
    ] as never);

    const res = await api.request("GET", "/admin/stats/questions.csv", { token });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("aios-question-times.csv");
    expect(res.body).toContain("FAIR data");
  });
});

describe.each(["/admin/stats/tests.csv", "/admin/stats/questions.csv"])("%s access", (path) => {
  it("is admin only", async () => {
    vi.mocked(isAdminEmail).mockReturnValue(false);
    expect((await api.request("GET", path, { token })).status).toBe(403);
    expect(listTestRows).not.toHaveBeenCalled();
    expect(listQuestionRows).not.toHaveBeenCalled();
  });

  it("needs a session and an existing account", async () => {
    expect((await api.request("GET", path)).status).toBe(401);
    vi.mocked(findLearnerById).mockResolvedValue(null);
    expect((await api.request("GET", path, { token })).status).toBe(401);
  });
});

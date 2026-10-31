import { beforeEach, describe, expect, it, vi } from "vitest";
import { learner } from "../../test/fixtures";
import { tokenFor, useTestServer } from "../../test/httpTestServer";
import { isAdminEmail } from "../identity/identity.admin";
import { findLearnerById } from "../identity/identity.service";
import { getDropoff } from "./dropoff.service";

vi.mock("../identity/identity.service");
vi.mock("../identity/identity.admin");
vi.mock("./dropoff.service");

const api = useTestServer();
const token = tokenFor("learner-1");
const PATH = "/admin/sat/dropoff";
const EMPTY = { summary: { started: 0, completed: 0, abandoned: 0, inProgress: 0 }, questions: [] };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findLearnerById).mockResolvedValue(learner());
  vi.mocked(isAdminEmail).mockReturnValue(true);
  vi.mocked(getDropoff).mockResolvedValue(EMPTY);
});

describe("GET /admin/sat/dropoff", () => {
  it("returns the aggregates with defaults (initial, 7 days)", async () => {
    const res = await api.request("GET", PATH, { token });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(EMPTY);
    expect(getDropoff).toHaveBeenCalledWith({
      type: "initial",
      sectionId: undefined,
      from: undefined,
      to: undefined,
      inactiveDays: 7,
    });
  });

  it("passes the filters through", async () => {
    const qs =
      "type=targeted_reevaluation&sectionId=s1&from=2026-10-01&to=2026-10-31&inactiveDays=14";
    await api.request("GET", `${PATH}?${qs}`, { token });

    expect(getDropoff).toHaveBeenCalledWith({
      type: "targeted_reevaluation",
      sectionId: "s1",
      from: new Date("2026-10-01"),
      to: new Date("2026-10-31"),
      inactiveDays: 14,
    });
  });

  it.each(["type=bogus", "inactiveDays=0", "inactiveDays=abc", "from=not-a-date"])(
    "rejects %s with 400",
    async (qs) => {
      expect((await api.request("GET", `${PATH}?${qs}`, { token })).status).toBe(400);
      expect(getDropoff).not.toHaveBeenCalled();
    },
  );

  it("is admin only", async () => {
    vi.mocked(isAdminEmail).mockReturnValue(false);
    expect((await api.request("GET", PATH, { token })).status).toBe(403);
    expect(getDropoff).not.toHaveBeenCalled();
  });

  it("needs a session and an existing account", async () => {
    expect((await api.request("GET", PATH)).status).toBe(401);
    vi.mocked(findLearnerById).mockResolvedValue(null);
    expect((await api.request("GET", PATH, { token })).status).toBe(401);
  });
});

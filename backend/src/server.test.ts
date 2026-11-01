import { beforeEach, describe, expect, it, vi } from "vitest";
import { learner } from "./test/fixtures";
import { tokenFor, useTestServer } from "./test/httpTestServer";
import { findLearnerById, listRoles } from "./modules/identity/identity.service";

vi.mock("./modules/identity/identity.service");

const api = useTestServer();
const token = tokenFor("learner-1");

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findLearnerById).mockResolvedValue(learner());
});

describe("buildServer", () => {
  it("answers unknown paths with JSON, not an HTML page", async () => {
    const res = await api.request("GET", "/no-such-route", { token });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("hides unexpected errors behind a generic 500 and logs them", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(listRoles).mockRejectedValue(new Error("password=hunter2 in a stack trace"));

    const res = await api.request("GET", "/roles", { token });

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
    expect(log).toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await api.request("POST", "/feedback", { token, rawBody: "{not json" });
    expect(res.status).toBe(400);
  });

  it("sends security headers", async () => {
    const res = await api.request("GET", "/no-such-route");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

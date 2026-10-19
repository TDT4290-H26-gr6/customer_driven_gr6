import { beforeEach, describe, expect, it, vi } from "vitest";
import { learner } from "../../test/fixtures";
import { tokenFor, useTestServer } from "../../test/httpTestServer";
import { isAdminEmail } from "../identity/identity.admin";
import { findLearnerById } from "../identity/identity.service";
import { createFeedback, listFeedback } from "./feedback.service";

vi.mock("../identity/identity.service");
vi.mock("../identity/identity.admin");
vi.mock("./feedback.service");

const api = useTestServer();
const token = tokenFor("learner-1");

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findLearnerById).mockResolvedValue(learner());
  vi.mocked(isAdminEmail).mockReturnValue(true);
});

describe("POST /feedback", () => {
  it("saves trimmed feedback for the signed-in learner", async () => {
    const res = await api.request("POST", "/feedback", {
      token,
      body: { message: "  The chart is hard to read ", page: "/dashboard" },
    });

    expect(res.status).toBe(204);
    expect(createFeedback).toHaveBeenCalledWith("learner-1", {
      message: "The chart is hard to read",
      suggestion: null,
      page: "/dashboard",
    });
  });

  it("is 400 without a message", async () => {
    const res = await api.request("POST", "/feedback", { token, body: { message: "  " } });
    expect(res.status).toBe(400);
    expect(createFeedback).not.toHaveBeenCalled();
  });

  it("is 401 without a session or for a deleted account", async () => {
    expect((await api.request("POST", "/feedback", { body: { message: "Hi" } })).status).toBe(401);
    vi.mocked(findLearnerById).mockResolvedValue(null);
    const res = await api.request("POST", "/feedback", { token, body: { message: "Hi" } });
    expect(res.status).toBe(401);
    expect(createFeedback).not.toHaveBeenCalled();
  });
});

describe("GET /admin/feedback", () => {
  it("lists feedback with who sent it", async () => {
    vi.mocked(listFeedback).mockResolvedValue([
      {
        id: "fb-1",
        learnerId: "learner-1",
        message: "Great",
        suggestion: null,
        page: "/faq",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        learner: { email: "learner@example.com", name: "Ada" },
      },
    ] as never);

    const res = await api.request("GET", "/admin/feedback", { token });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: "fb-1",
        message: "Great",
        suggestion: null,
        page: "/faq",
        createdAt: "2026-01-01T00:00:00.000Z",
        learner: { email: "learner@example.com", name: "Ada" },
      },
    ]);
  });

  it("is admin only", async () => {
    vi.mocked(isAdminEmail).mockReturnValue(false);
    expect((await api.request("GET", "/admin/feedback", { token })).status).toBe(403);
    expect(listFeedback).not.toHaveBeenCalled();
  });
});

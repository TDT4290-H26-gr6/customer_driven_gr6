import { describe, expect, it, vi } from "vitest";
import { findLearnerById } from "../modules/identity/identity.service";
import { requireRole } from "./requireRole";
import type { AuthedRequest } from "./requireAuth";

vi.mock("../modules/identity/identity.service", () => ({
  findLearnerById: vi.fn(),
}));

function mockRes() {
  const res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe("requireRole", () => {
  it("calls next() when the learner has picked a role", async () => {
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: "student" } as never);
    const req = { learnerId: "learner-1" } as AuthedRequest;
    const res = mockRes();
    const next = vi.fn();

    await requireRole(req, res as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("403s when the learner exists but hasn't picked a role", async () => {
    vi.mocked(findLearnerById).mockResolvedValue({ roleId: null } as never);
    const req = { learnerId: "learner-1" } as AuthedRequest;
    const res = mockRes();
    const next = vi.fn();

    await requireRole(req, res as never, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when the learner can't be found (token outlived a deleted account)", async () => {
    vi.mocked(findLearnerById).mockResolvedValue(null as never);
    const req = { learnerId: "learner-1" } as AuthedRequest;
    const res = mockRes();
    const next = vi.fn();

    await requireRole(req, res as never, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("passes a failed lookup to next(err) instead of rejecting unhandled", async () => {
    const dbError = new Error("Can't reach database server");
    vi.mocked(findLearnerById).mockRejectedValue(dbError);
    const req = { learnerId: "learner-1" } as AuthedRequest;
    const res = mockRes();
    const next = vi.fn();

    await requireRole(req, res as never, next);

    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.status).not.toHaveBeenCalled();
  });
});

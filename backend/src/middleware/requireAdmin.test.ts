import { describe, expect, it, vi } from "vitest";
import { findLearnerById } from "../modules/identity/identity.service";
import { isAdminEmail } from "../modules/identity/identity.admin";
import { requireAdmin } from "./requireAdmin";
import type { AuthedRequest } from "./requireAuth";

vi.mock("../modules/identity/identity.service", () => ({
  findLearnerById: vi.fn(),
}));

vi.mock("../modules/identity/identity.admin", () => ({
  isAdminEmail: vi.fn(),
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

const req = { learnerId: "learner-1" } as AuthedRequest;

describe("requireAdmin", () => {
  it("calls next() for an admin", async () => {
    vi.mocked(findLearnerById).mockResolvedValue({ email: "admin@ntnu.no" } as never);
    vi.mocked(isAdminEmail).mockReturnValue(true);
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("403s for a learner who isn't an admin", async () => {
    vi.mocked(findLearnerById).mockResolvedValue({ email: "student@ntnu.no" } as never);
    vi.mocked(isAdminEmail).mockReturnValue(false);
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res as never, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when the learner no longer exists", async () => {
    vi.mocked(findLearnerById).mockResolvedValue(null as never);
    const res = mockRes();
    const next = vi.fn();

    await requireAdmin(req, res as never, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { requireAuth, type AuthedRequest } from "./requireAuth";

function mockRes() {
  const res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

function mockReq(authorization?: string): AuthedRequest {
  return { headers: { authorization } } as AuthedRequest;
}

describe("requireAuth", () => {
  it("401s when there's no Authorization header", () => {
    const req = mockReq(undefined);
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res as never, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when the header doesn't start with 'Bearer '", () => {
    const req = mockReq("Basic sometoken");
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res as never, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("sets req.learnerId and calls next() for a valid token", () => {
    const token = jwt.sign({ learnerId: "learner-123" }, config.jwtSecret);
    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res as never, next);

    expect(req.learnerId).toBe("learner-123");
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("401s for a malformed token", () => {
    const req = mockReq("Bearer not-a-real-jwt");
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res as never, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s for a token signed with the wrong secret", () => {
    const token = jwt.sign({ learnerId: "learner-123" }, "some-other-secret");
    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res as never, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s for an expired token", () => {
    const token = jwt.sign({ learnerId: "learner-123" }, config.jwtSecret, { expiresIn: -1 });
    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res as never, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

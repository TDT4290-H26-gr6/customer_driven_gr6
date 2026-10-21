import { beforeEach, describe, expect, it, vi } from "vitest";
import { learner } from "../../test/fixtures";
import { tokenFor, useTestServer } from "../../test/httpTestServer";
import { isAdminEmail } from "./identity.admin";
import * as identity from "./identity.service";

vi.mock("./identity.service");
vi.mock("./identity.admin");

const api = useTestServer();
const token = tokenFor("admin-1");

/** What Prisma throws when a row the grant points at doesn't exist. */
const foreignKeyError = Object.assign(new Error("Foreign key constraint failed"), {
  code: "P2003",
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(identity.findLearnerById).mockResolvedValue(learner({ id: "admin-1" }));
  vi.mocked(isAdminEmail).mockReturnValue(true);
});

it("GET /admin/visibility returns the role × section matrix", async () => {
  vi.mocked(identity.getVisibilityMatrix).mockResolvedValue({ roles: [] } as never);
  const res = await api.request("GET", "/admin/visibility", { token });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ roles: [] });
});

describe.each([
  ["sections", "grantSection", "revokeSection"],
  ["competences", "grantCompetence", "revokeCompetence"],
] as const)("/admin/roles/:roleId/%s/:id", (kind, grant, revoke) => {
  const path = `/admin/roles/role-1/${kind}/item-1`;

  it("PUT grants it, recording who granted it", async () => {
    const res = await api.request("PUT", path, { token });
    expect(res.status).toBe(204);
    expect(identity[grant]).toHaveBeenCalledWith("role-1", "item-1", "admin-1");
  });

  it("PUT is 404 when the role or item doesn't exist", async () => {
    vi.mocked(identity[grant]).mockRejectedValue(foreignKeyError);
    const res = await api.request("PUT", path, { token });
    expect(res.status).toBe(404);
  });

  it("PUT passes any other failure on as a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(identity[grant]).mockRejectedValue(new Error("database down"));
    const res = await api.request("PUT", path, { token });
    expect(res.status).toBe(500);
    // The real error stays in the log, not in the response.
    expect(res.body).toEqual({ error: expect.not.stringContaining("database down") });
  });

  it("DELETE revokes it", async () => {
    const res = await api.request("DELETE", path, { token });
    expect(res.status).toBe(204);
    expect(identity[revoke]).toHaveBeenCalledWith("role-1", "item-1");
  });

  it("is admin only", async () => {
    vi.mocked(isAdminEmail).mockReturnValue(false);
    expect((await api.request("PUT", path, { token })).status).toBe(403);
    expect((await api.request("DELETE", path, { token })).status).toBe(403);
    expect(identity[grant]).not.toHaveBeenCalled();
    expect(identity[revoke]).not.toHaveBeenCalled();
  });
});

it("admin routes are 401 without a session or for a deleted account", async () => {
  expect((await api.request("GET", "/admin/visibility")).status).toBe(401);
  vi.mocked(identity.findLearnerById).mockResolvedValue(null);
  expect((await api.request("GET", "/admin/visibility", { token })).status).toBe(401);
});

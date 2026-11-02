import { beforeEach, expect, it, vi } from "vitest";
import { learner } from "../../test/fixtures";
import { tokenFor, useTestServer } from "../../test/httpTestServer";
import { isAdminEmail } from "./identity.admin";
import * as identity from "./identity.service";

vi.mock("./identity.service");
vi.mock("./identity.admin");

const api = useTestServer();
const token = tokenFor("admin-1");

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

it("admin routes are 401 without a session or for a deleted account", async () => {
  expect((await api.request("GET", "/admin/visibility")).status).toBe(401);
  vi.mocked(identity.findLearnerById).mockResolvedValue(null);
  expect((await api.request("GET", "/admin/visibility", { token })).status).toBe(401);
});

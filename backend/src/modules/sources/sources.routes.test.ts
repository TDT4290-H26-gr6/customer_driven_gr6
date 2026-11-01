import { beforeEach, expect, it, vi } from "vitest";
import { prisma } from "../../db/prisma";
import { learner } from "../../test/fixtures";
import { tokenFor, useTestServer } from "../../test/httpTestServer";
import { findLearnerById } from "../identity/identity.service";

vi.mock("../../db/prisma", () => ({ prisma: { source: { findMany: vi.fn() } } }));
vi.mock("../identity/identity.service");

const api = useTestServer();
const token = tokenFor("learner-1");

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findLearnerById).mockResolvedValue(learner());
});

it("GET /sources lists the sources by institution, then course", async () => {
  vi.mocked(prisma.source.findMany).mockResolvedValue([{ id: "src-1" }] as never);

  const res = await api.request("GET", "/sources", { token });

  expect(res.status).toBe(200);
  expect(res.body).toEqual([{ id: "src-1" }]);
  expect(prisma.source.findMany).toHaveBeenCalledWith({
    orderBy: [{ institution: "asc" }, { courseName: "asc" }],
  });
});

it("GET /sources needs a session", async () => {
  expect((await api.request("GET", "/sources")).status).toBe(401);
});

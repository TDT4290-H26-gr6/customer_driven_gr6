import { beforeEach, expect, it, vi } from "vitest";
import { prisma } from "../../db/prisma";
import { useTestServer } from "../../test/httpTestServer";

vi.mock("../../db/prisma", () => ({ prisma: { $queryRaw: vi.fn() } }));

const api = useTestServer();

beforeEach(() => {
  vi.mocked(prisma.$queryRaw).mockReset();
});

it("GET /health is ok when the database answers", async () => {
  vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }] as never);
  const res = await api.request("GET", "/health");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok", database: "connected" });
});

it("GET /health is 500 when the database is unreachable", async () => {
  vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("ECONNREFUSED"));
  const res = await api.request("GET", "/health");
  expect(res.status).toBe(500);
  expect(res.body).toEqual({ status: "error", database: "unreachable" });
});

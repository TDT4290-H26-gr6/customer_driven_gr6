import { describe, expect, it, vi } from "vitest";
import { deleteLearner } from "./identity.service";
import { prisma } from "../../db/prisma";

vi.mock("../../db/prisma", () => ({
  prisma: {
    learner: { delete: vi.fn() },
  },
}));

const mockPrisma = vi.mocked(prisma, true);

describe("deleteLearner", () => {
  it("deletes the learner by id — everything else cascades at the DB level", async () => {
    await deleteLearner("learner-1");

    expect(mockPrisma.learner.delete).toHaveBeenCalledWith({ where: { id: "learner-1" } });
  });
});

import { describe, expect, it, vi } from "vitest";
import { createFeedback, listFeedback } from "./feedback.service";
import { prisma } from "../../db/prisma";

vi.mock("../../db/prisma", () => ({
  prisma: {
    feedback: { create: vi.fn(), findMany: vi.fn() },
  },
}));

const mockPrisma = vi.mocked(prisma, true);

describe("createFeedback", () => {
  it("stores the feedback against the learner who sent it", async () => {
    await createFeedback("learner-1", {
      message: "Slow",
      suggestion: null,
      page: "/results",
      rating: 3,
    });

    expect(mockPrisma.feedback.create).toHaveBeenCalledWith({
      data: {
        learnerId: "learner-1",
        message: "Slow",
        suggestion: null,
        page: "/results",
        rating: 3,
      },
    });
  });
});

describe("listFeedback", () => {
  it("returns newest first, with only the sender's email and name", async () => {
    await listFeedback();

    expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      include: { learner: { select: { email: true, name: true } } },
    });
  });
});

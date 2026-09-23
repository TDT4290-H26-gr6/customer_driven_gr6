import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteLearner } from "./identity.service";
import { prisma } from "../../db/prisma";
import { deleteRecommendationsForLearner } from "../learningJourney/learningJourney.service";

vi.mock("../../db/prisma", () => ({
  prisma: {
    learner: { delete: vi.fn() },
  },
}));

vi.mock("../learningJourney/learningJourney.service", () => ({
  deleteRecommendationsForLearner: vi.fn(),
}));

const mockPrisma = vi.mocked(prisma, true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteLearner", () => {
  it("deletes the learner's journey recommendations before deleting the learner", async () => {
    const calls: string[] = [];
    vi.mocked(deleteRecommendationsForLearner).mockImplementation((() => {
      calls.push("recommendations");
      return Promise.resolve({ count: 2 });
    }) as never);
    mockPrisma.learner.delete.mockImplementation((() => {
      calls.push("learner");
      return Promise.resolve({});
    }) as never);

    await deleteLearner("learner-1");

    // Order matters: JourneyRecommendation.learnerId isn't a real FK (see
    // learningJourney.prisma), so nothing stops it from outliving the
    // learner it points at unless it's cleared out first.
    expect(calls).toEqual(["recommendations", "learner"]);
  });

  it("calls both cleanup steps for the given learner", async () => {
    await deleteLearner("learner-42");

    expect(deleteRecommendationsForLearner).toHaveBeenCalledWith("learner-42");
    expect(mockPrisma.learner.delete).toHaveBeenCalledWith({ where: { id: "learner-42" } });
  });
});

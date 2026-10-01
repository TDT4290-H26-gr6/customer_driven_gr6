import { describe, expect, it, vi } from "vitest";
import { deleteLearner, getSelectedJourney, selectJourney } from "./identity.service";
import { prisma } from "../../db/prisma";

vi.mock("../../db/prisma", () => ({
  prisma: {
    learner: { delete: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

const mockPrisma = vi.mocked(prisma, true);

describe("deleteLearner", () => {
  it("deletes the learner by id — everything else cascades at the DB level", async () => {
    await deleteLearner("learner-1");

    expect(mockPrisma.learner.delete).toHaveBeenCalledWith({ where: { id: "learner-1" } });
  });
});

describe("getSelectedJourney", () => {
  it("returns the learner's selected journey, with its modules", async () => {
    mockPrisma.learner.findUnique.mockResolvedValue({
      selectedJourney: { id: "journey-1", name: "Journey A", modules: [] },
    } as never);

    const journey = await getSelectedJourney("learner-1");

    expect(journey).toEqual({ id: "journey-1", name: "Journey A", modules: [] });
    expect(mockPrisma.learner.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "learner-1" } }),
    );
  });

  it("returns null when the learner hasn't selected a journey", async () => {
    mockPrisma.learner.findUnique.mockResolvedValue({ selectedJourney: null } as never);
    expect(await getSelectedJourney("learner-1")).toBeNull();
  });

  it("returns null when the learner doesn't exist", async () => {
    mockPrisma.learner.findUnique.mockResolvedValue(null);
    expect(await getSelectedJourney("learner-1")).toBeNull();
  });
});

describe("selectJourney", () => {
  it("sets the learner's selectedJourneyId and returns the now-selected journey", async () => {
    mockPrisma.learner.update.mockResolvedValue({} as never);
    mockPrisma.learner.findUnique.mockResolvedValue({
      selectedJourney: { id: "journey-1", name: "Journey A", modules: [] },
    } as never);

    const journey = await selectJourney("learner-1", "journey-1");

    expect(mockPrisma.learner.update).toHaveBeenCalledWith({
      where: { id: "learner-1" },
      data: { selectedJourneyId: "journey-1" },
    });
    expect(journey).toEqual({ id: "journey-1", name: "Journey A", modules: [] });
  });

  it("propagates the error (unknown journey id) instead of swallowing it", async () => {
    const fkError = Object.assign(new Error("FK violation"), { code: "P2003" });
    mockPrisma.learner.update.mockRejectedValue(fkError);

    await expect(selectJourney("learner-1", "missing-journey")).rejects.toThrow("FK violation");
  });
});

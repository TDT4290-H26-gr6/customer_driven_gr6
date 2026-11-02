import { describe, expect, it } from "vitest";
import { medianRating, ratingCounts, ratingInfo, RATINGS } from "./ratings";

describe("the satisfaction scale", () => {
  it("runs from very unhappy (1) to very happy (5)", () => {
    expect(RATINGS.map((r) => r.value)).toEqual([1, 2, 3, 4, 5]);
    expect(ratingInfo(1)?.label).toBe("Very unhappy");
    expect(ratingInfo(5)?.label).toBe("Very happy");
    expect(ratingInfo(9)).toBeNull();
  });
});

describe("medianRating", () => {
  it("is the middle rating of an odd count", () => {
    expect(medianRating([5, 1, 4])).toBe(4);
  });

  it("lands halfway between the two middle ones of an even count", () => {
    expect(medianRating([2, 5, 3, 4])).toBe(3.5);
  });

  it("isn't pulled down by one very unhappy rating, as a mean would be", () => {
    expect(medianRating([1, 4, 4, 5, 5])).toBe(4);
  });

  it("is null without any ratings", () => {
    expect(medianRating([])).toBeNull();
  });
});

describe("ratingCounts", () => {
  it("counts each face, including ones nobody chose", () => {
    expect(ratingCounts([4, 4, 5, 1]).map((r) => r.count)).toEqual([1, 0, 0, 2, 1]);
  });
});

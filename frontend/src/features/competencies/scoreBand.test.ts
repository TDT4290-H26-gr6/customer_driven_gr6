import { describe, expect, it } from "vitest";
import { scoreBand } from "./scoreBand";

describe("scoreBand", () => {
  it("is weak at or below 60% — the dashboard's 'Where you're lacking' line", () => {
    expect(scoreBand(0)).toBe("weak");
    expect(scoreBand(60)).toBe("weak");
  });

  it("is good from 61% to 84%", () => {
    expect(scoreBand(61)).toBe("good");
    expect(scoreBand(84)).toBe("good");
  });

  it("is strong from 85%", () => {
    expect(scoreBand(85)).toBe("strong");
    expect(scoreBand(100)).toBe("strong");
  });
});

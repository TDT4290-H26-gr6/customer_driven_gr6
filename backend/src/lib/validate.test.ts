import { describe, expect, it } from "vitest";
import { HttpError } from "./httpError";
import { plausibleDurationMs, requireObject, requireString } from "./validate";

describe("requireString", () => {
  it("returns a non-empty string unchanged", () => {
    expect(requireString("q1", "questionId")).toBe("q1");
  });

  it.each([undefined, null, 42, {}, [], "", "   ", "x".repeat(192)])(
    "throws a 400 for %j",
    (value) => {
      expect(() => requireString(value, "questionId")).toThrow(HttpError);
      expect(() => requireString(value, "questionId")).toThrow("Missing or invalid questionId");
    },
  );

  it("accepts a longer string when given a larger maxLength (e.g. a Google ID token)", () => {
    const credential = "x".repeat(1200);
    expect(requireString(credential, "credential", 4096)).toBe(credential);
  });

  it("still rejects a string over the given maxLength", () => {
    expect(() => requireString("x".repeat(4097), "credential", 4096)).toThrow(
      "Missing or invalid credential",
    );
  });
});

describe("requireObject", () => {
  it("returns a plain object unchanged", () => {
    const answer = { session: {}, complete: true };
    expect(requireObject(answer, "answer")).toBe(answer);
  });

  it.each([undefined, null, "text", 1, true, []])("throws a 400 for %j", (value) => {
    expect(() => requireObject(value, "answer")).toThrow("Missing or invalid answer");
  });
});

describe("plausibleDurationMs", () => {
  const MAX = 60_000;

  it("returns a valid value unchanged", () => {
    expect(plausibleDurationMs(4200, MAX)).toBe(4200);
  });

  it("accepts the boundaries 0 and max", () => {
    expect(plausibleDurationMs(0, MAX)).toBe(0);
    expect(plausibleDurationMs(MAX, MAX)).toBe(MAX);
  });

  it.each([undefined, null, -1, MAX + 1, 1.5, "4200", {}, [], true, NaN, Infinity])(
    "returns undefined instead of throwing, for %j",
    (value) => {
      expect(plausibleDurationMs(value, MAX)).toBeUndefined();
    },
  );
});

import { describe, expect, it } from "vitest";
import { DATE_FORMAT } from "./format";

describe("DATE_FORMAT", () => {
  it("writes dates in English, day first, whatever the browser's language", () => {
    expect(DATE_FORMAT.format(new Date("2026-10-03T12:00:00Z"))).toBe("3 Oct 2026");
  });
});

import { describe, expect, it } from "vitest";
import { experienceBucket, toCsv } from "./stats.csv";

describe("toCsv", () => {
  it("writes a header row then one row per record, in column order", () => {
    const csv = toCsv(
      ["b", "a"],
      [
        { a: 1, b: "x" },
        { a: 2, b: "y" },
      ],
    );
    expect(csv).toBe("b,a\r\nx,1\r\ny,2\r\n");
  });

  it("quotes a field containing a comma, quote or newline, doubling internal quotes", () => {
    const csv = toCsv(
      ["value"],
      [{ value: "has, a comma" }, { value: 'has "quotes"' }, { value: "has\na newline" }],
    );
    expect(csv).toBe('value\r\n"has, a comma"\r\n"has ""quotes"""\r\n"has\na newline"\r\n');
  });

  it("writes null/undefined as an empty field, not the literal word", () => {
    const csv = toCsv(["value"], [{ value: null }, { value: undefined }]);
    expect(csv).toBe("value\r\n\r\n\r\n");
  });

  it("returns just the header row for no records", () => {
    expect(toCsv(["a", "b"], [])).toBe("a,b\r\n");
  });
});

describe("experienceBucket", () => {
  it.each([
    [0, "0-2"],
    [2, "0-2"],
    [3, "3-5"],
    [5, "3-5"],
    [6, "6-10"],
    [10, "6-10"],
    [11, "11+"],
    [50, "11+"],
  ])("buckets %i years as %s", (years, expected) => {
    expect(experienceBucket(years)).toBe(expected);
  });

  it.each([null, undefined])("returns an empty string for %s", (value) => {
    expect(experienceBucket(value)).toBe("");
  });
});

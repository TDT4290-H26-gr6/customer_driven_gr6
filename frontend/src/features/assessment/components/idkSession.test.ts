import { describe, expect, it } from "vitest";
import { clearOthersIfIdk, IDK_VALUE } from "./idkSession";

const sessionWith = (value: string[]) => ({ id: "s", data: [{ id: "1", value }] });

describe("clearOthersIfIdk", () => {
  it("drops the other ticks when I don't know is among them", () => {
    expect(clearOthersIfIdk(sessionWith(["a", "b", IDK_VALUE]))).toEqual(sessionWith([IDK_VALUE]));
  });

  it("leaves ordinary answers alone", () => {
    const session = sessionWith(["a", "b"]);
    expect(clearOthersIfIdk(session)).toBe(session);
  });

  it("leaves a lone I don't know alone", () => {
    const session = sessionWith([IDK_VALUE]);
    expect(clearOthersIfIdk(session)).toBe(session);
  });

  it("passes through sessions that aren't choice sessions", () => {
    expect(clearOthersIfIdk(undefined)).toBeUndefined();
    expect(clearOthersIfIdk({})).toEqual({});
  });
});

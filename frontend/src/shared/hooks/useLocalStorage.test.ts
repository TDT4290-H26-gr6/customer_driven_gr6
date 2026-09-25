import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useLocalStorage } from "./useLocalStorage";

beforeEach(() => {
  localStorage.clear();
});

describe("useLocalStorage", () => {
  it("starts with the initial value when nothing is stored yet", () => {
    const { result } = renderHook(() => useLocalStorage("count", 0));
    expect(result.current[0]).toBe(0);
  });

  it("reads a previously stored value instead of the initial value", () => {
    localStorage.setItem("count", JSON.stringify(42));
    const { result } = renderHook(() => useLocalStorage("count", 0));
    expect(result.current[0]).toBe(42);
  });

  it("persists updates to localStorage as JSON", () => {
    const { result } = renderHook(() => useLocalStorage("count", 0));

    act(() => result.current[1](5));

    expect(result.current[0]).toBe(5);
    expect(localStorage.getItem("count")).toBe("5");
  });

  it("supports a functional updater, like useState", () => {
    const { result } = renderHook(() => useLocalStorage("count", 1));

    act(() => result.current[1]((prev) => prev + 1));

    expect(result.current[0]).toBe(2);
  });

  it("falls back to the initial value when the stored JSON is corrupted", () => {
    localStorage.setItem("count", "{not valid json");
    const { result } = renderHook(() => useLocalStorage("count", 7));
    expect(result.current[0]).toBe(7);
  });
});

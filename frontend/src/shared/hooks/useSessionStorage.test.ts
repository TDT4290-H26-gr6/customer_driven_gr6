import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStorage } from "./useSessionStorage";

beforeEach(() => {
  sessionStorage.clear();
});

describe("useSessionStorage", () => {
  it("starts with the initial value when nothing is stored yet", () => {
    const { result } = renderHook(() => useSessionStorage("draft", ""));
    expect(result.current[0]).toBe("");
  });

  it("reads a previously stored value instead of the initial value", () => {
    sessionStorage.setItem("draft", JSON.stringify("hello"));
    const { result } = renderHook(() => useSessionStorage("draft", ""));
    expect(result.current[0]).toBe("hello");
  });

  it("persists updates to sessionStorage as JSON, separately from localStorage", () => {
    const { result } = renderHook(() => useSessionStorage("draft", ""));

    act(() => result.current[1]("in progress"));

    expect(sessionStorage.getItem("draft")).toBe(JSON.stringify("in progress"));
    expect(localStorage.getItem("draft")).toBeNull();
  });

  it("falls back to the initial value when the stored JSON is corrupted", () => {
    sessionStorage.setItem("draft", "{not valid json");
    const { result } = renderHook(() => useSessionStorage("draft", "fallback"));
    expect(result.current[0]).toBe("fallback");
  });
});

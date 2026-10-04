import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { AccentProvider, useAccent } from "./AccentProvider";

const wrapper = ({ children }: { children: ReactNode }) => (
  <AccentProvider>{children}</AccentProvider>
);

describe("AccentProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-accent");
  });

  it("defaults to purple and applies it to <html>", () => {
    const { result } = renderHook(() => useAccent(), { wrapper });
    expect(result.current.accent).toBe("purple");
    expect(document.documentElement.getAttribute("data-accent")).toBe("purple");
  });

  it("applies and persists a new choice", () => {
    const { result } = renderHook(() => useAccent(), { wrapper });
    act(() => result.current.setAccent("olive"));
    expect(document.documentElement.getAttribute("data-accent")).toBe("olive");
    expect(localStorage.getItem("aios.accentColor")).toBe('"olive"');
  });

  it("restores the stored choice", () => {
    localStorage.setItem("aios.accentColor", '"blue"');
    const { result } = renderHook(() => useAccent(), { wrapper });
    expect(result.current.accent).toBe("blue");
  });

  it("falls back to purple for an unknown stored value", () => {
    localStorage.setItem("aios.accentColor", '"indigo"');
    const { result } = renderHook(() => useAccent(), { wrapper });
    expect(result.current.accent).toBe("purple");
  });
});

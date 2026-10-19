import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/matchMedia";
import { ThemeProvider, useTheme } from "./ThemeProvider";

function ThemeProbe() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  return (
    <>
      <p>
        {preference} → {resolvedTheme}
      </p>
      <button onClick={() => setPreference("dark")}>Dark</button>
      <button onClick={() => setPreference("light")}>Light</button>
      <button onClick={() => setPreference("default")}>Default</button>
    </>
  );
}

const osPrefersDark = (dark: boolean) => (query: string) =>
  query === "(prefers-color-scheme: dark)" ? dark : false;

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeProvider", () => {
  it("follows the OS by default, live", () => {
    const media = stubMatchMedia(osPrefersDark(false));
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByText("default → light")).toBeInTheDocument();
    expect(document.documentElement).not.toHaveAttribute("data-theme");

    act(() => media.change(osPrefersDark(true)));

    expect(screen.getByText("default → dark")).toBeInTheDocument();
  });

  it("applies and remembers an explicit choice", async () => {
    stubMatchMedia(osPrefersDark(false));
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(screen.getByText("dark → dark")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("aios.themePreference")).toBe('"dark"');

    await userEvent.click(screen.getByRole("button", { name: "Default" }));
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  it("starts from the saved choice", () => {
    stubMatchMedia(osPrefersDark(true));
    localStorage.setItem("aios.themePreference", '"light"');
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByText("light → light")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("useTheme fails loudly outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow("within a ThemeProvider");
  });
});

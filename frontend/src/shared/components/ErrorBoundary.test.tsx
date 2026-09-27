import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom({ explode }: { explode: boolean }) {
  if (explode) throw new Error("render failed");
  return <p>page content</p>;
}

// React logs caught render errors itself; keep the test output readable.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders its children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <Boom explode={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  it("shows a fallback with a reload button instead of a blank page", () => {
    render(
      <ErrorBoundary>
        <Boom explode />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: /reload page/i })).toBeInTheDocument();
  });

  it("renders the children again when the resetKey changes (e.g. navigating away)", () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/broken">
        <Boom explode />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKey="/sources">
        <Boom explode={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

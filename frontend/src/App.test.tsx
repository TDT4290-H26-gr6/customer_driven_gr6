import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAuth } from "@/app/providers/AuthProvider";
import { stubMatchMedia } from "@/test/matchMedia";
import { App } from "./App";

// The routes have their own tests; this checks the app is wired together:
// router, every provider, and the routes inside them.
vi.mock("@/routes", () => ({
  AppRoutes: function RoutesProbe() {
    const { status } = useAuth();
    return <p>routes ({status})</p>;
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

it("renders the routes inside the router and every provider", () => {
  stubMatchMedia(() => false);
  render(<App />);
  // No saved session, so AuthProvider settles on signed out without a request.
  expect(screen.getByText("routes (signedOut)")).toBeInTheDocument();
});

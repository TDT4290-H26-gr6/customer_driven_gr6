import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GreetingBot } from "./GreetingBot";

// jsdom has no WebGL, so the three.js scene itself is mocked.
const { createGreetingBot, dispose } = vi.hoisted(() => {
  const dispose = vi.fn();
  const createGreetingBot = vi.fn(() => ({ wave: vi.fn(), setEyesClosed: vi.fn(), dispose }));
  return { createGreetingBot, dispose };
});
vi.mock("./greetingBotScene", () => ({ createGreetingBot }));

function setMobile(mobile: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: mobile,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe("GreetingBot", () => {
  beforeEach(() => {
    createGreetingBot.mockClear();
    dispose.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("mounts the robot on desktop, hidden from screen readers, and disposes it on unmount", async () => {
    setMobile(false);
    const { container, unmount } = render(<GreetingBot />);
    const stage = container.firstElementChild;
    expect(stage).toHaveAttribute("aria-hidden", "true");

    await vi.waitFor(() => expect(createGreetingBot).toHaveBeenCalledWith(stage));
    unmount();
    expect(dispose).toHaveBeenCalled();
  });

  it("renders nothing and loads nothing on mobile", async () => {
    setMobile(true);
    const { container } = render(<GreetingBot />);
    expect(container).toBeEmptyDOMElement();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(createGreetingBot).not.toHaveBeenCalled();
  });
});

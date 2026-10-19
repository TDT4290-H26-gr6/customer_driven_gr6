import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "@/app/providers/ThemeProvider";
import { googleLogin } from "../api";
import { GoogleLoginButton } from "./GoogleLoginButton";

vi.mock("@/app/providers/ThemeProvider", () => ({ useTheme: vi.fn() }));
vi.mock("../api", () => ({ googleLogin: vi.fn() }));

// A stand-in for Google's sign-in script (loaded from accounts.google.com).
const initialize = vi.fn();
const renderButton = vi.fn((parent: HTMLElement) => {
  parent.innerHTML = "<button>Sign in with Google</button>";
});

/** The callback Google calls with the signed-in user's credential. */
const googleCallback = () =>
  initialize.mock.calls[0][0].callback as (response: { credential: string }) => Promise<void>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useTheme).mockReturnValue({ resolvedTheme: "light" } as never);
  window.google = { accounts: { id: { initialize, renderButton } } };
});

afterEach(() => {
  delete window.google;
});

describe("GoogleLoginButton", () => {
  it("draws Google's button, outlined in light mode", () => {
    const { container } = render(<GoogleLoginButton onLogin={vi.fn()} />);
    expect(renderButton).toHaveBeenCalledWith(container.firstChild, {
      theme: "outline",
      size: "large",
    });
    expect(container).toHaveTextContent("Sign in with Google");
  });

  it("redraws it dark, once, when the theme turns dark", () => {
    const { container, rerender } = render(<GoogleLoginButton onLogin={vi.fn()} />);
    vi.mocked(useTheme).mockReturnValue({ resolvedTheme: "dark" } as never);
    rerender(<GoogleLoginButton onLogin={vi.fn()} />);

    expect(renderButton).toHaveBeenLastCalledWith(container.firstChild, {
      theme: "filled_black",
      size: "large",
    });
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });

  it("signs in with the credential Google hands back", async () => {
    const learner = { id: "learner-1" };
    vi.mocked(googleLogin).mockResolvedValue({ token: "t", learner } as never);
    const onLogin = vi.fn();
    render(<GoogleLoginButton onLogin={onLogin} />);

    await googleCallback()({ credential: "google-credential" });

    expect(googleLogin).toHaveBeenCalledWith("google-credential");
    expect(onLogin).toHaveBeenCalledWith(learner);
  });

  it("stays put when the backend refuses the sign-in", async () => {
    vi.mocked(googleLogin).mockRejectedValue(new Error("401"));
    const onLogin = vi.fn();
    render(<GoogleLoginButton onLogin={onLogin} />);

    await expect(googleCallback()({ credential: "forged" })).resolves.toBeUndefined();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("renders an empty slot when Google's script hasn't loaded (e.g. blocked)", () => {
    delete window.google;
    const { container } = render(<GoogleLoginButton onLogin={vi.fn()} />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });
});

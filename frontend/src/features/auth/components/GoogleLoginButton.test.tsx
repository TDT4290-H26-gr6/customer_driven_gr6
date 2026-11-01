import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { googleLogin } from "../api";
import { GoogleLoginButton } from "./GoogleLoginButton";

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
  window.google = { accounts: { id: { initialize, renderButton } } };
});

afterEach(() => {
  delete window.google;
});

describe("GoogleLoginButton", () => {
  it("draws Google's white, outlined button", () => {
    const { container } = render(<GoogleLoginButton onLogin={vi.fn()} />);
    expect(renderButton).toHaveBeenCalledWith(container.firstChild, {
      theme: "outline",
      size: "large",
    });
    expect(container).toHaveTextContent("Sign in with Google");
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

  describe("when Google's script is still loading", () => {
    let script: HTMLScriptElement;
    beforeEach(() => {
      delete window.google;
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      document.head.appendChild(script);
    });
    afterEach(() => script.remove());

    it("draws the button once it has loaded", () => {
      const { container } = render(<GoogleLoginButton onLogin={vi.fn()} />);
      expect(renderButton).not.toHaveBeenCalled();

      window.google = { accounts: { id: { initialize, renderButton } } };
      script.dispatchEvent(new Event("load"));

      expect(container).toHaveTextContent("Sign in with Google");
    });

    it("stops waiting once the login page is gone", () => {
      const { unmount } = render(<GoogleLoginButton onLogin={vi.fn()} />);
      unmount();

      window.google = { accounts: { id: { initialize, renderButton } } };
      script.dispatchEvent(new Event("load"));

      expect(renderButton).not.toHaveBeenCalled();
    });
  });

  it("renders an empty slot when Google's script hasn't loaded (e.g. blocked)", () => {
    delete window.google;
    const { container } = render(<GoogleLoginButton onLogin={vi.fn()} />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });
});

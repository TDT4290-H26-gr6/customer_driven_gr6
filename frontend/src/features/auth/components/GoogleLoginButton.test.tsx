import { act, render, screen } from "@testing-library/react";
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

  it("stays put, and says so, when the backend refuses the sign-in", async () => {
    vi.mocked(googleLogin).mockRejectedValue({ status: 401, message: "Unauthorized" });
    const onLogin = vi.fn();
    render(<GoogleLoginButton onLogin={onLogin} />);

    await act(() => googleCallback()({ credential: "forged" }));
    expect(onLogin).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Signing in with Google didn't work");
  });

  it("says when the server couldn't be reached to finish signing in", async () => {
    vi.mocked(googleLogin).mockRejectedValue({ status: 0, message: "The server took too long" });
    render(<GoogleLoginButton onLogin={vi.fn()} />);

    await act(() => googleCallback()({ credential: "google-credential" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't reach AIOS to finish signing in");
  });

  it("clears the message once a later attempt signs in", async () => {
    vi.mocked(googleLogin)
      .mockRejectedValueOnce({ status: 0, message: "timeout" })
      .mockResolvedValueOnce({ token: "t", learner: { id: "l1" } } as never);
    const onLogin = vi.fn();
    render(<GoogleLoginButton onLogin={onLogin} />);

    await act(() => googleCallback()({ credential: "first" }));
    await act(() => googleCallback()({ credential: "second" }));
    expect(onLogin).toHaveBeenCalledWith({ id: "l1" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  describe("when Google's script is still loading", () => {
    let script: HTMLScriptElement;
    let readyState: { mockRestore(): void };
    beforeEach(() => {
      delete window.google;
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      document.head.appendChild(script);
      // The page is still loading: async scripts hold off "complete".
      readyState = vi.spyOn(document, "readyState", "get").mockReturnValue("interactive");
    });
    afterEach(() => {
      script.remove();
      readyState.mockRestore();
    });

    it("draws the button once it has loaded", () => {
      const { container } = render(<GoogleLoginButton onLogin={vi.fn()} />);
      expect(renderButton).not.toHaveBeenCalled();

      window.google = { accounts: { id: { initialize, renderButton } } };
      script.dispatchEvent(new Event("load"));

      expect(container).toHaveTextContent("Sign in with Google");
    });

    it("says so when it fails to load, since it's the only way to sign in", () => {
      render(<GoogleLoginButton onLogin={vi.fn()} />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      act(() => {
        script.dispatchEvent(new Event("error"));
      });

      expect(screen.getByRole("alert")).toHaveTextContent("Google sign-in couldn't load");
    });

    it("stops waiting once the login page is gone", () => {
      const { unmount } = render(<GoogleLoginButton onLogin={vi.fn()} />);
      unmount();

      window.google = { accounts: { id: { initialize, renderButton } } };
      script.dispatchEvent(new Event("load"));

      expect(renderButton).not.toHaveBeenCalled();
    });
  });

  it("says so when the page has loaded without Google's script (e.g. blocked)", () => {
    delete window.google;
    const { container } = render(<GoogleLoginButton onLogin={vi.fn()} />);
    expect(container.firstChild).toBeEmptyDOMElement();
    expect(screen.getByRole("alert")).toHaveTextContent("Google sign-in couldn't load");
  });
});

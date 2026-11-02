import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `orcidEnabled` is read once at import time, so each test loads a fresh copy
// with the env it needs.
async function loadButton(clientId: string) {
  vi.resetModules();
  vi.doMock("@/config/env", () => ({
    env: {
      ORCID_CLIENT_ID: clientId,
      ORCID_REDIRECT_URI: "http://localhost:5173/auth/orcid/callback",
    },
  }));
  return (await import("./OrcidLoginButton")).OrcidLoginButton;
}

const assign = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  Object.defineProperty(window, "location", {
    value: { ...window.location, assign, origin: "http://localhost:5173" },
    writable: true,
  });
});

describe("OrcidLoginButton", () => {
  it("renders nothing without an ORCID client id", async () => {
    const OrcidLoginButton = await loadButton("");
    const { container } = render(<OrcidLoginButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sends the browser to ORCID's authorize page, remembering the state", async () => {
    const OrcidLoginButton = await loadButton("APP-1");
    render(<OrcidLoginButton />);

    await userEvent.click(screen.getByRole("button", { name: /sign in with orcid/i }));

    const url = new URL(assign.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://orcid.org/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("APP-1");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("/authenticate");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:5173/auth/orcid/callback");
    expect(url.searchParams.get("state")).toBe(sessionStorage.getItem("orcid-oauth-state"));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./client";
import { clearToken, getToken } from "./token";

vi.mock("./token", () => ({
  getToken: vi.fn(),
  clearToken: vi.fn(),
}));

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

describe("apiFetch", () => {
  it("attaches the bearer token when one is stored", async () => {
    vi.mocked(getToken).mockReturnValue("token-123");
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("/questions");

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer token-123");
  });

  it("omits the Authorization header when auth: false", async () => {
    vi.mocked(getToken).mockReturnValue("token-123");
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("/health", { auth: false });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.headers as Record<string, string>).not.toHaveProperty("Authorization");
  });

  it("JSON-serializes a request body and sets Content-Type", async () => {
    vi.mocked(getToken).mockReturnValue(null);
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("/assessment/responses", { method: "POST", body: { questionId: "q1" } });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.body).toBe(JSON.stringify({ questionId: "q1" }));
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("prefixes the path with the configured API base URL", async () => {
    vi.mocked(getToken).mockReturnValue(null);
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("/questions");

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("http://localhost:4000/questions");
  });

  it("returns undefined for a 204 response instead of parsing a body", async () => {
    vi.mocked(getToken).mockReturnValue(null);
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    const result = await apiFetch("/assessment/complete", { method: "POST" });

    expect(result).toBeUndefined();
  });

  it("clears the stored token on a 401", async () => {
    vi.mocked(getToken).mockReturnValue("stale-token");
    vi.mocked(fetch).mockResolvedValue(
      new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }),
    );

    await expect(apiFetch("/auth/me")).rejects.toBeTruthy();
    expect(clearToken).toHaveBeenCalledOnce();
  });

  it("throws an ApiError carrying the status and response body for a non-OK response", async () => {
    vi.mocked(getToken).mockReturnValue(null);
    vi.mocked(fetch).mockResolvedValue(
      new Response("Role required", { status: 403, statusText: "Forbidden" }),
    );

    await expect(apiFetch("/questions")).rejects.toEqual({
      status: 403,
      message: "Role required",
    });
  });

  it("falls back to statusText when the error response has no body", async () => {
    vi.mocked(getToken).mockReturnValue(null);
    vi.mocked(fetch).mockResolvedValue(
      new Response("", { status: 500, statusText: "Server Error" }),
    );

    await expect(apiFetch("/questions")).rejects.toEqual({
      status: 500,
      message: "Server Error",
    });
  });
});

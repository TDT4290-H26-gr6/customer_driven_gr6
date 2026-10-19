import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, onUnauthorized } from "./client";
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

  it("uses the `error` field of a JSON error body as the message", async () => {
    vi.mocked(getToken).mockReturnValue(null);
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: "Unknown question" }, { status: 404 }),
    );

    await expect(apiFetch("/assessment/responses")).rejects.toEqual({
      status: 404,
      message: "Unknown question",
    });
  });

  it("turns a network failure into an ApiError with status 0", async () => {
    vi.mocked(getToken).mockReturnValue(null);
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiFetch("/questions")).rejects.toEqual({
      status: 0,
      message: "Couldn't reach the server. Check your connection.",
    });
  });

  it("times out a request that never answers", async () => {
    vi.mocked(getToken).mockReturnValue(null);
    vi.mocked(fetch).mockImplementation(neverAnswers);

    await expect(apiFetch("/questions", { timeoutMs: 10 })).rejects.toEqual({
      status: 0,
      message: "The server took too long to respond.",
    });
  });

  it("rethrows the caller's own AbortError when the caller cancels", async () => {
    vi.mocked(getToken).mockReturnValue(null);
    vi.mocked(fetch).mockImplementation(neverAnswers);
    const controller = new AbortController();

    const request = apiFetch("/questions", { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });

  it("turns an unparsable success body into an ApiError", async () => {
    vi.mocked(getToken).mockReturnValue(null);
    vi.mocked(fetch).mockResolvedValue(new Response("<html>", { status: 200 }));

    await expect(apiFetch("/questions")).rejects.toEqual({
      status: 200,
      message: "The server sent an invalid response.",
    });
  });

  it("notifies onUnauthorized listeners on a 401 for a request that carried the token", async () => {
    vi.mocked(getToken).mockReturnValue("stale-token");
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 401 }));
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);

    await expect(apiFetch("/auth/me")).rejects.toBeTruthy();
    unsubscribe();

    expect(listener).toHaveBeenCalledOnce();
  });

  it("leaves the session alone on a 401 for a request sent without the token", async () => {
    vi.mocked(getToken).mockReturnValue("valid-token");
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 401 }));
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);

    await expect(apiFetch("/auth/google", { auth: false })).rejects.toBeTruthy();
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
    expect(clearToken).not.toHaveBeenCalled();
  });

  it("returns the raw Blob instead of parsing JSON when responseType is 'blob'", async () => {
    vi.mocked(getToken).mockReturnValue("token-123");
    vi.mocked(fetch).mockResolvedValue(
      new Response("a,b\r\n1,2\r\n", { status: 200, headers: { "Content-Type": "text/csv" } }),
    );

    const result = await apiFetch<Blob>("/admin/stats/tests.csv", { responseType: "blob" });

    // Not toBeInstanceOf(Blob): jsdom's Response.blob() can return a Blob
    // from a different realm than the test file's global Blob constructor,
    // so a strict instanceof check is flaky — duck-type it instead.
    expect(typeof result.text).toBe("function");
    expect(await result.text()).toBe("a,b\r\n1,2\r\n");
  });

  it("still returns undefined for a 204 when responseType is 'blob'", async () => {
    vi.mocked(getToken).mockReturnValue("token-123");
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    const result = await apiFetch("/admin/stats/tests.csv", { responseType: "blob" });

    expect(result).toBeUndefined();
  });
});

/** A fetch that only settles when its signal aborts — like a server that never answers. */
function neverAnswers(_url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("Aborted", "AbortError")),
    );
  });
}

import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll } from "vitest";
import { config } from "../config";
import { buildServer } from "../server";

// Shared setup for route tests: the real Express app (every middleware, the
// 404 and error handlers) on a random free port, called with Node's own
// fetch. The services behind the routes are mocked in each test file with
// vi.mock, so no database is needed.

type RequestOptions = {
  /** Sent as JSON. */
  body?: unknown;
  /** Sent as-is with a JSON content type, e.g. to test malformed JSON. */
  rawBody?: string;
  /** Sent as `Authorization: Bearer <token>`; see tokenFor. */
  token?: string;
};

export type TestResponse = {
  status: number;
  /** Parsed JSON, or the raw text for non-JSON bodies; undefined when empty. */
  body: unknown;
  headers: Headers;
};

/** A session token for this learner, signed exactly like /auth/google does. */
export function tokenFor(learnerId: string): string {
  return jwt.sign({ learnerId }, config.jwtSecret, { algorithm: "HS256", expiresIn: "5m" });
}

/**
 * Starts the app before the file's tests and stops it after. Returns a
 * `request` function: `await api.request("GET", "/auth/me", { token })`.
 */
export function useTestServer() {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    server = buildServer().listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  async function request(
    method: string,
    path: string,
    { body, rawBody, token }: RequestOptions = {},
  ): Promise<TestResponse> {
    const headers: Record<string, string> = {};
    if (body !== undefined || rawBody !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(baseUrl + path, {
      method,
      headers,
      body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const text = await res.text();
    const isJson = res.headers.get("content-type")?.includes("application/json");
    return {
      status: res.status,
      body: text === "" ? undefined : isJson ? JSON.parse(text) : text,
      headers: res.headers,
    };
  }

  return { request };
}

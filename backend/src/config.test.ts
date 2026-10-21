import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// config.ts reads process.env once, when it's first imported, so each test
// sets the environment and imports a fresh copy.
async function loadConfig(env: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value as string);
  vi.resetModules();
  return (await import("./config.js")).config;
}

/** A complete, valid production environment. */
const production = {
  NODE_ENV: "production",
  JWT_SECRET: "a-long-random-secret",
  GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
  CORS_ORIGIN: "https://aios.idi.ntnu.no",
  ADMIN_EMAILS: "Admin@NTNU.no, second@ntnu.no",
};

const SETTINGS = [
  "NODE_ENV",
  "JWT_SECRET",
  "GOOGLE_CLIENT_ID",
  "CORS_ORIGIN",
  "ADMIN_EMAILS",
  "BACKEND_PORT",
  "LLM_API_KEY",
  "LLM_BASE_URL",
  "LLM_MODEL",
];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  // Start every test from an empty environment, whatever the machine has set.
  for (const name of SETTINGS) vi.stubEnv(name, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("in development", () => {
  it("falls back to safe defaults, with a warning, when settings are missing", async () => {
    const config = await loadConfig({ NODE_ENV: "development" });

    expect(config.port).toBe(4000);
    expect(config.jwtSecret).toBe("dev-secret-change-me");
    expect(config.corsOrigins).toBe(true);
    expect(config.adminEmails).toBe("everyone");
    expect(config.llm).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("JWT_SECRET"));
  });

  it("treats a value still copied from .env.example as missing", async () => {
    const config = await loadConfig({ JWT_SECRET: "<some-long-random-string>" });
    expect(config.jwtSecret).toBe("dev-secret-change-me");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("placeholder"));
  });
});

describe("in production", () => {
  it("reads every setting", async () => {
    const config = await loadConfig({
      ...production,
      BACKEND_PORT: "4100",
      CORS_ORIGIN: "https://aios.idi.ntnu.no, ,https://other.ntnu.no",
      LLM_API_KEY: "sk-test",
      LLM_BASE_URL: "https://llm.example.org/v1///",
      LLM_MODEL: "some-model",
    });

    expect(config.port).toBe(4100);
    expect(config.jwtSecret).toBe("a-long-random-secret");
    expect(config.corsOrigins).toEqual(["https://aios.idi.ntnu.no", "https://other.ntnu.no"]);
    expect(config.adminEmails).toEqual(["admin@ntnu.no", "second@ntnu.no"]);
    expect(config.llm).toEqual({
      apiKey: "sk-test",
      baseUrl: "https://llm.example.org/v1",
      model: "some-model",
    });
  });

  it("uses NTNU's LLM endpoint and model by default", async () => {
    const config = await loadConfig({ ...production, LLM_API_KEY: "sk-test" });
    expect(config.llm).toEqual({
      apiKey: "sk-test",
      baseUrl: "https://llm.hpc.ntnu.no/v1",
      model: "openai/gpt-oss-120b",
    });
  });

  it("refuses to start without a JWT secret", async () => {
    await expect(loadConfig({ ...production, JWT_SECRET: "" })).rejects.toThrow(
      "JWT_SECRET is not set",
    );
  });

  it("refuses to start with a placeholder secret", async () => {
    await expect(loadConfig({ ...production, JWT_SECRET: "<secret>" })).rejects.toThrow(
      "placeholder",
    );
  });

  it("refuses to start without CORS_ORIGIN", async () => {
    await expect(loadConfig({ ...production, CORS_ORIGIN: "" })).rejects.toThrow("CORS_ORIGIN");
  });

  it("lets nobody use admin mode when ADMIN_EMAILS is unset (fail closed)", async () => {
    const config = await loadConfig({ ...production, ADMIN_EMAILS: "" });
    expect(config.adminEmails).toEqual([]);
  });
});

describe("validation", () => {
  it.each(["0", "70000", "abc", "40.5"])("rejects BACKEND_PORT=%s", async (port) => {
    await expect(loadConfig({ BACKEND_PORT: port })).rejects.toThrow("BACKEND_PORT");
  });
});

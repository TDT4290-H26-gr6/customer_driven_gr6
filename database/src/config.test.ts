import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// config.ts reads process.env once, when it's first imported, so each test
// sets the environment and imports a fresh copy.
async function loadConfig(env: Record<string, string>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.resetModules();
  return (await import("./config.js")).config;
}

beforeEach(() => {
  vi.stubEnv("MOODLE_BASE_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("config", () => {
  it("defaults to the placeholder Moodle site", async () => {
    expect((await loadConfig({})).moodleBaseUrl).toBe("https://moodle.example.org");
  });

  it("reads the Moodle site, without a trailing slash", async () => {
    const config = await loadConfig({ MOODLE_BASE_URL: "https://moodle.ntnu.no//" });
    expect(config.moodleBaseUrl).toBe("https://moodle.ntnu.no");
  });

  it("accepts a local Moodle test server over http", async () => {
    const config = await loadConfig({ MOODLE_BASE_URL: "http://localhost:8080/" });
    expect(config.moodleBaseUrl).toBe("http://localhost:8080");
  });

  it.each([
    "moodle.ntnu.no",
    "http://moodle.ntnu.no",
    "javascript:alert(1)",
    "ftp://moodle.ntnu.no",
  ])("rejects MOODLE_BASE_URL=%s", async (value) => {
    await expect(loadConfig({ MOODLE_BASE_URL: value })).rejects.toThrow("MOODLE_BASE_URL");
  });
});

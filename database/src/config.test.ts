import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// config.ts reads process.env once, when it's first imported, so each test
// sets the environment and imports a fresh copy.
async function loadConfig(env: Record<string, string>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.resetModules();
  return (await import("./config.js")).config;
}

beforeEach(() => {
  vi.stubEnv("SEED_DATASET", "");
  vi.stubEnv("MOODLE_BASE_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("config", () => {
  it("defaults to the fake dataset and the placeholder Moodle site", async () => {
    const config = await loadConfig({});
    expect(config.seedDataset).toBe("fake");
    expect(config.moodleBaseUrl).toBe("https://moodle.example.org");
  });

  it("reads the dataset (any case, spaces trimmed) and the Moodle site (no trailing slash)", async () => {
    const config = await loadConfig({
      SEED_DATASET: " WP2 ",
      MOODLE_BASE_URL: "https://moodle.ntnu.no//",
    });
    expect(config.seedDataset).toBe("wp2");
    expect(config.moodleBaseUrl).toBe("https://moodle.ntnu.no");
  });

  it("accepts fake by name", async () => {
    expect((await loadConfig({ SEED_DATASET: "fake" })).seedDataset).toBe("fake");
  });

  it("rejects an unknown dataset", async () => {
    await expect(loadConfig({ SEED_DATASET: "real" })).rejects.toThrow("SEED_DATASET");
  });
});

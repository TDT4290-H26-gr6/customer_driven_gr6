import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**"],
      // Only code a unit test can't meaningfully run — keep this list short.
      exclude: [
        "src/**/*.test.ts",
        // Shared test helpers, not app code.
        "src/test/**",
        // Process startup and shutdown: listening, signals.
        "src/index.ts",
        // Constructs the Prisma client; every test mocks it.
        "src/db/prisma.ts",
      ],
      // CI fails below these (npm run test:coverage).
      thresholds: {
        lines: 90,
        statements: 90,
        branches: 90,
        functions: 90,
      },
    },
  },
});

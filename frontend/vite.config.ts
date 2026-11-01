/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { contentSecurityPolicy } from "./src/config/contentSecurityPolicy";

/**
 * The PIE player's entry (dist/index.js) loads its other files at runtime
 * with `import(specifier)`, paths the bundler can't follow, relative to
 * wherever that entry ends up: in the production build, inside the main
 * bundle in assets/. The dev server serves them straight from node_modules,
 * but a build would leave them out (the question player then fails to
 * load), so this copies them into assets/ under their own names.
 */
function copyPieRuntimeFiles(): Plugin {
  const dir = fileURLToPath(
    new URL("./node_modules/@pie-framework/pie-fixed-player-static/dist/", import.meta.url),
  );
  return {
    name: "copy-pie-runtime-files",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const file of readdirSync(dir)) {
        const fileName = `assets/${file}`;
        if (!file.endsWith(".js") || file === "index.js" || fileName in bundle) continue;
        this.emitFile({ type: "asset", fileName, source: readFileSync(dir + file) });
      }
    },
  };
}

/**
 * Puts the Content-Security-Policy (see src/config/contentSecurityPolicy.ts)
 * at the top of the built index.html, with a hash for each inline <script>
 * so they still run. Only in the build: the dev server injects scripts of
 * its own for hot reload.
 */
function contentSecurityPolicyMeta(apiUrl: string): Plugin {
  return {
    name: "content-security-policy-meta",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const inlineScriptHashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          ([, code]) => `'sha256-${createHash("sha256").update(code).digest("base64")}'`,
        );
        const policy = contentSecurityPolicy({ apiUrl, inlineScriptHashes });
        return html.replace(
          "<head>",
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
        );
      },
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    copyPieRuntimeFiles(),
    // The same fallback as src/config/env.ts.
    contentSecurityPolicyMeta(
      loadEnv(mode, process.cwd(), "VITE_").VITE_API_URL || "http://localhost:4000",
    ),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    allowedHosts: ["aios.idi.ntnu.no"],
    watch: { usePolling: true },
  },
  optimizeDeps: {
    exclude: ["@pie-framework/pie-fixed-player-static"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**"],
      // Only code a unit test can't meaningfully run, keep this list short.
      exclude: [
        "src/**/*.test.{ts,tsx}",
        // Shared test helpers, not app code.
        "src/test/**",
        // Mounts the app into the real page.
        "src/main.tsx",
        // Barrels: one-line re-exports with no logic of their own.
        "src/features/*/index.ts",
        "src/vite-env.d.ts",
        // The robot's three.js scene: needs WebGL, which jsdom doesn't have.
        // GreetingBot.tsx, which loads it, is tested.
        "src/features/auth/components/greetingBotScene.ts",
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
}));

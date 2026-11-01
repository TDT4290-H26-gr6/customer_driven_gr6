import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, inlineScripts } from "./contentSecurityPolicy";

function directives(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy.split("; ").map((d) => {
      const [name, ...sources] = d.split(" ");
      return [name, sources];
    }),
  );
}

describe("contentSecurityPolicy", () => {
  const policy = directives(
    contentSecurityPolicy({
      apiUrl: "https://aios.example.org/api/v1",
      inlineScriptHashes: ["'sha256-abc='"],
    }),
  );

  it("runs only the app's own scripts, the hashed inline one and Google sign-in", () => {
    expect(policy["script-src"]).toEqual([
      "'self'",
      "'sha256-abc='",
      "https://accounts.google.com/gsi/client",
    ]);
  });

  it("never allows inline event handlers, eval or plugins", () => {
    expect(policy["script-src"]).not.toContain("'unsafe-inline'");
    expect(policy["script-src"]).not.toContain("'unsafe-eval'");
    expect(policy["object-src"]).toEqual(["'none'"]);
    expect(policy["base-uri"]).toEqual(["'self'"]);
  });

  it("lets the page talk only to itself, the API's origin and Google sign-in", () => {
    expect(policy["connect-src"]).toEqual([
      "'self'",
      "https://aios.example.org",
      "https://accounts.google.com/gsi/",
    ]);
    expect(policy["frame-src"]).toEqual(["https://accounts.google.com/gsi/"]);
  });

  it("needs nothing extra for an API on the page's own origin (a relative VITE_API_URL)", () => {
    const sameOrigin = directives(
      contentSecurityPolicy({ apiUrl: "/api", inlineScriptHashes: [] }),
    );
    expect(sameOrigin["connect-src"]).toEqual(["'self'", "https://accounts.google.com/gsi/"]);
  });

  it("falls back to the page itself for anything not listed", () => {
    expect(policy["default-src"]).toEqual(["'self'"]);
  });
});

describe("inlineScripts", () => {
  it("finds each inline script, with or without attributes, but not one loaded from a file", () => {
    const html = `<head>
      <script>one()</script>
      <script type="module" async>two()</script>
      <script src="https://accounts.google.com/gsi/client" async defer></script>
      <SCRIPT>three()</SCRIPT>
    </head>`;
    expect(inlineScripts(html)).toEqual(["one()", "two()", "three()"]);
  });

  it("hashes what the browser runs: Windows line endings become \\n", () => {
    expect(inlineScripts("<script>\r\n  a();\r\n  b();\r</script>")).toEqual([
      "\n  a();\n  b();\n",
    ]);
  });
});

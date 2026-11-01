/** Google Identity Services, the sign-in button (see index.html and GoogleLoginButton). */
const GOOGLE_SIGN_IN = "https://accounts.google.com/gsi/";

/** A full URL's origin; nothing for a relative one, which 'self' already covers. */
function originOf(url: string): string[] {
  try {
    return [new URL(url).origin];
  } catch {
    return [];
  }
}

/**
 * The production build's Content-Security-Policy, which vite.config.ts puts
 * in index.html as a <meta> tag. It tells the browser to run only the
 * scripts this app ships (its own files, the inline theme script by its
 * hash, and Google's sign-in script), so HTML that ever got injected into a
 * page couldn't run anything. It also limits where the page may send data:
 * itself, the API and Google sign-in.
 *
 * - Styles allow 'unsafe-inline': the question player (PIE, Material-UI) sets
 *   inline styles and adds <style> elements at runtime. Styles can't run
 *   code.
 * - frame-ancestors can't be set from a <meta> tag; nginx.conf sends it,
 *   with the other security headers.
 */
export function contentSecurityPolicy({
  apiUrl,
  inlineScriptHashes,
}: {
  /** VITE_API_URL: only its origin is allowed, a path would limit requests to that path. */
  apiUrl: string;
  /** Each inline <script>'s `'sha256-…'` source. */
  inlineScriptHashes: string[];
}): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", ...inlineScriptHashes, `${GOOGLE_SIGN_IN}client`],
    "style-src": ["'self'", "'unsafe-inline'", `${GOOGLE_SIGN_IN}style`],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...originOf(apiUrl), GOOGLE_SIGN_IN],
    "frame-src": [GOOGLE_SIGN_IN],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

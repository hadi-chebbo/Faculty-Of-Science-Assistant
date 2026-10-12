// Helpers for auth route handlers. Next.js specific code stays here and out of the services.

export const NO_STORE = { "Cache-Control": "no-store" } as const;

// CSRF rule for every state-changing auth request: the browser must tell us the request comes
// from our own host. We compare the host of the Origin header (or, when the browser sent no
// Origin, of the Referer) with the host of the URL this request was made to. A missing or
// unparseable value is rejected, so the check fails closed. Browsers always send Origin on a
// cross-site POST, and the cookies are SameSite=Lax as a second layer.
export function isSameOrigin(request: Request): boolean {
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!source) return false;
  try {
    return new URL(source).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

// The first hop of x-forwarded-for, which is the client address as appended by the hosting proxy
// (Vercel). This trusts that proxy: if the app were reachable without one, a caller could send any
// header and dodge the per-IP limit (the per-email limit would still hold).
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.slice(0, 64);
  const real = request.headers.get("x-real-ip")?.trim();
  return real ? real.slice(0, 64) : "unknown";
}

// Where to send the visitor after restoring a session. Only a same-site relative path is allowed
// (one leading slash, no "//" or backslash tricks, no scheme); anything else becomes the fallback.
export function safeNextPath(value: string | null | undefined, fallback = "/admin"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const base = "http://localhost";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

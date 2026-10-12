import type { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "@/services/auth/constants";
import type { SessionTokens } from "@/services/auth/types";

export const ACCESS_COOKIE = "ua_access";
export const REFRESH_COOKIE = "ua_refresh";

// The access cookie goes to every page (they need to know who is asking). The refresh cookie is
// only ever sent to the auth endpoints, so ordinary page requests never carry it.
export const ACCESS_COOKIE_PATH = "/";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

// Secure in production, except on localhost where `next start` runs over plain http.
function isSecure(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const hostname = new URL(request.url).hostname;
  return !["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}

function base(request: Request) {
  return { httpOnly: true, sameSite: "lax", secure: isSecure(request) } as const;
}

export function setSessionCookies(response: NextResponse, request: Request, tokens: SessionTokens): void {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...base(request),
    path: ACCESS_COOKIE_PATH,
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...base(request),
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function clearSessionCookies(response: NextResponse, request: Request): void {
  response.cookies.set(ACCESS_COOKIE, "", { ...base(request), path: ACCESS_COOKIE_PATH, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...base(request), path: REFRESH_COOKIE_PATH, maxAge: 0 });
}

export function readRefreshCookie(request: NextRequest): string {
  return request.cookies.get(REFRESH_COOKIE)?.value ?? "";
}

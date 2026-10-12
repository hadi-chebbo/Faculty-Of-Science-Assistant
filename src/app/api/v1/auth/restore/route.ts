import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookies, readRefreshCookie, setSessionCookies } from "@/lib/auth/cookies";
import { NO_STORE, safeNextPath } from "@/lib/auth/request";
import { refreshSession } from "@/services/auth/auth";
import { InvalidSessionError } from "@/services/errors";

const redirectTo = (request: NextRequest, path: string) =>
  NextResponse.redirect(new URL(path, request.url), { status: 303, headers: NO_STORE });

// Where /admin sends a visitor whose access token is missing or expired. If the refresh cookie
// (which the browser only sends to /api/v1/auth) is still good, it is rotated and the visitor
// continues to `next` without typing the password; otherwise they go to /sign-in.
// This is a GET that changes state, so it refuses requests a browser marks as cross-site (a
// link on another site cannot make it rotate the visitor's tokens). `next` must be a same-site
// relative path; anything else becomes /admin.
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (request.headers.get("sec-fetch-site") === "cross-site") return redirectTo(request, "/sign-in");

  const refreshToken = readRefreshCookie(request);
  if (!refreshToken) return redirectTo(request, "/sign-in");

  try {
    const session = await refreshSession(refreshToken);
    const response = redirectTo(request, next);
    setSessionCookies(response, request, session);
    return response;
  } catch (error) {
    const response = redirectTo(request, "/sign-in");
    if (error instanceof InvalidSessionError) {
      // Leaves no valid cookie behind, so /admin and /sign-in cannot bounce the visitor in a loop.
      clearSessionCookies(response, request);
    } else {
      // A temporary failure (for example the database): keep the cookies so a retry can work.
      console.error("restore failed", error);
    }
    return response;
  }
}

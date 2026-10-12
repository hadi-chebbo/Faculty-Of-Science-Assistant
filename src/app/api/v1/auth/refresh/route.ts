import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookies, readRefreshCookie, setSessionCookies } from "@/lib/auth/cookies";
import { isSameOrigin, NO_STORE } from "@/lib/auth/request";
import { refreshSession } from "@/services/auth/auth";
import { InvalidSessionError } from "@/services/errors";

const reply = (body: object, status: number) => NextResponse.json(body, { status, headers: NO_STORE });

// Rotates the refresh token (read from its cookie) and issues new cookies.
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return reply({ error: "Forbidden" }, 403);

  try {
    const session = await refreshSession(readRefreshCookie(request));
    const response = reply({ user: { email: session.user.email, role: session.user.role } }, 200);
    setSessionCookies(response, request, session);
    return response;
  } catch (error) {
    if (error instanceof InvalidSessionError) {
      const response = reply({ error: "Session expired" }, 401);
      clearSessionCookies(response, request);
      return response;
    }
    console.error("refresh failed", error);
    return reply({ error: "Internal error" }, 500);
  }
}

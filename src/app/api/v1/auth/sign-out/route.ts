import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookies, readRefreshCookie } from "@/lib/auth/cookies";
import { isSameOrigin, NO_STORE } from "@/lib/auth/request";
import { signOut } from "@/services/auth/auth";

const reply = (body: object, status: number) => NextResponse.json(body, { status, headers: NO_STORE });

// Revokes the session and clears both cookies. Safe to call when already signed out.
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return reply({ error: "Forbidden" }, 403);

  try {
    await signOut(readRefreshCookie(request));
  } catch (error) {
    // Still clear the cookies below: the visitor wants to be signed out of this browser.
    console.error("sign-out failed to revoke the session", error);
  }
  const response = reply({ ok: true }, 200);
  clearSessionCookies(response, request);
  return response;
}

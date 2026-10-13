import { NextResponse, type NextRequest } from "next/server";
import { readRefreshCookie } from "@/lib/auth/cookies";
import { NO_STORE } from "@/lib/auth/request";
import { getViewer } from "@/lib/auth/viewer";
import { getAccount } from "@/services/auth/auth";

// Who is signed in, for the header account control. Never returns the email or a token.
// `renewable` tells the browser whether a refresh could bring the session back (expired access
// cookie, refresh cookie still present), so an anonymous visitor costs exactly one request.
export async function GET(request: NextRequest) {
  let account = null;
  try {
    account = await getAccount(await getViewer());
  } catch (error) {
    // An unreadable session is treated as signed out, as the open route does.
    console.error("me: could not read the session", error);
  }
  const user = account ? { name: account.name, role: account.role } : null;
  const renewable = !user && readRefreshCookie(request) !== "";
  return NextResponse.json({ user, renewable }, { status: 200, headers: NO_STORE });
}

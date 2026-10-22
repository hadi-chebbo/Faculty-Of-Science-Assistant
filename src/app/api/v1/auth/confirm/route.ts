import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin, NO_STORE, readJsonObject } from "@/lib/auth/request";
import { confirmEmail } from "@/services/auth/sign-up";
import { InvalidConfirmationTokenError } from "@/services/errors";

const reply = (body: object, status: number) => NextResponse.json(body, { status, headers: NO_STORE });

// POST, not GET: mail scanners that prefetch the emailed link must not use up the single-use
// token. The /confirm-email page posts it from the browser. Confirms only; it signs nobody in.
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return reply({ error: "Forbidden" }, 403);

  const { token } = await readJsonObject(request);
  try {
    await confirmEmail(typeof token === "string" ? token : "");
    return reply({ ok: true }, 200);
  } catch (error) {
    if (error instanceof InvalidConfirmationTokenError) {
      return reply({ error: "Invalid or expired link", code: "invalid_token" }, 400);
    }
    console.error("email confirmation failed", error);
    return reply({ error: "Internal error" }, 500);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin, NO_STORE, readJsonObject, tooManyAttemptsBody } from "@/lib/auth/request";
import { sendEmailJobAfterResponse } from "@/lib/send-email-job-after-response";
import { resendConfirmation } from "@/services/auth/sign-up";
import { TooManyAttemptsError, ValidationError } from "@/services/errors";

const reply = (body: object, status: number, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });

// 202 whether or not the address has an unconfirmed account. The per-address limit counts every
// address, so a 429 does not reveal whether one exists either.
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return reply({ error: "Forbidden" }, 403);

  const { email } = await readJsonObject(request);
  try {
    const { jobId } = await resendConfirmation({ email: email as string });
    if (jobId) sendEmailJobAfterResponse(jobId);
    return reply({ ok: true }, 202);
  } catch (error) {
    if (error instanceof ValidationError) {
      return reply({ error: "Invalid request", fields: { email: "Enter a valid email address." } }, 400);
    }
    if (error instanceof TooManyAttemptsError) {
      return reply(tooManyAttemptsBody(error.retryAfterSeconds), 429, { "Retry-After": String(error.retryAfterSeconds) });
    }
    console.error("resend confirmation failed", error);
    return reply({ error: "Internal error" }, 500);
  }
}

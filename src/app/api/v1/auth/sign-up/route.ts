import { NextResponse, type NextRequest } from "next/server";
import { clientIp, isSameOrigin, NO_STORE, readJsonObject, tooManyAttemptsBody } from "@/lib/auth/request";
import { sendEmailJobAfterResponse } from "@/lib/send-email-job-after-response";
import { signUp } from "@/services/auth/sign-up";
import { PASSWORD_MIN_LENGTH } from "@/services/auth/constants";
import { TooManyAttemptsError, ValidationError } from "@/services/errors";

const reply = (body: object, status: number, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });

const FIELD_MESSAGES: Record<string, string> = {
  email: "Enter a valid email address.",
  password: `At least ${PASSWORD_MIN_LENGTH} characters.`,
  name: "At most 100 characters.",
};

// The answer is the same for a new address, an existing one and one over its email limit, so it
// never tells whether an account exists. The email itself is sent after the response.
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return reply({ error: "Forbidden" }, 403);

  const { email, password, name } = await readJsonObject(request);
  try {
    const { jobId } = await signUp({
      email: email as string,
      password: password as string,
      name: name as string | undefined,
      ip: clientIp(request),
    });
    if (jobId) sendEmailJobAfterResponse(jobId);
    return reply({ ok: true }, 202);
  } catch (error) {
    if (error instanceof ValidationError) {
      const fields = Object.fromEntries(
        error.fields.filter((field) => field in FIELD_MESSAGES).map((field) => [field, FIELD_MESSAGES[field]]),
      );
      return reply({ error: "Invalid request", fields }, 400);
    }
    if (error instanceof TooManyAttemptsError) {
      return reply(tooManyAttemptsBody(error.retryAfterSeconds), 429, { "Retry-After": String(error.retryAfterSeconds) });
    }
    console.error("sign-up failed", error);
    return reply({ error: "Internal error" }, 500);
  }
}

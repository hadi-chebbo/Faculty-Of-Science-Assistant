import { NextResponse, type NextRequest } from "next/server";
import { setSessionCookies } from "@/lib/auth/cookies";
import { clientIp, isSameOrigin, NO_STORE } from "@/lib/auth/request";
import { EmailNotConfirmedError, InvalidCredentialsError, TooManyAttemptsError, ValidationError } from "@/services/errors";
import { signIn } from "@/services/auth/auth";

const reply = (body: object, status: number, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });

// Tokens go out only as httpOnly cookies, never in the body.
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return reply({ error: "Forbidden" }, 403);

  const body: unknown = await request.json().catch(() => null);
  const { email, password } = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") return reply({ error: "Invalid request" }, 400);

  try {
    const session = await signIn({ email, password, ip: clientIp(request) });
    const response = reply({ user: { email: session.user.email, role: session.user.role } }, 200);
    setSessionCookies(response, request, session);
    return response;
  } catch (error) {
    if (error instanceof ValidationError) return reply({ error: "Invalid request" }, 400);
    if (error instanceof InvalidCredentialsError) return reply({ error: "Invalid email or password" }, 401);
    if (error instanceof EmailNotConfirmedError) {
      return reply({ error: "Email not confirmed", code: "email_not_confirmed" }, 403);
    }
    if (error instanceof TooManyAttemptsError) {
      return reply(
        { error: "Too many attempts", retryAfterSeconds: error.retryAfterSeconds },
        429,
        { "Retry-After": String(error.retryAfterSeconds) },
      );
    }
    console.error("sign-in failed", error);
    return reply({ error: "Internal error" }, 500);
  }
}

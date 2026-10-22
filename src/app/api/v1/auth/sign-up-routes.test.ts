import { hash } from "@node-rs/argon2";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { confirmEmailHandler } from "@/services/auth/emails";
import { POST as confirm } from "./confirm/route";
import { POST as resend } from "./resend-confirmation/route";
import { POST as signIn } from "./sign-in/route";
import { POST as signUp } from "./sign-up/route";

// `after()` only works inside a real request; the routes hand the job id to this function.
const sendAfterResponse = vi.hoisted(() => vi.fn());
vi.mock("@/lib/send-email-job-after-response", () => ({ sendEmailJobAfterResponse: sendAfterResponse }));

const ORIGIN = "http://localhost:3210";
const PASSWORD = "a-long-enough-password";
let ipCounter = 0;

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  ipCounter += 1;
  return new NextRequest(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": `198.51.100.${ipCounter}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(async () => {
  await truncateAllTables();
  sendAfterResponse.mockClear();
});
afterAll(closeDb);

async function tokenFor(email: string): Promise<string> {
  const job = (await getDb().EmailJob.findOne({ where: { toEmail: email, kind: "confirm-email" } }))!;
  const content = await confirmEmailHandler({ id: job.id, kind: job.kind, toEmail: job.toEmail, payload: job.payload, attempts: 1 });
  return content!.text.match(/token=([A-Za-z0-9_-]+)/)![1];
}

describe("POST /api/v1/auth/sign-up", () => {
  it("answers 202 { ok: true }, no-store, and schedules the email after the response", async () => {
    const response = await signUp(post("/api/v1/auth/sign-up", { email: "a@example.com", password: PASSWORD, name: "Ann" }));
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
    expect(sendAfterResponse).toHaveBeenCalledTimes(1);
  });

  it("answers the same for an existing confirmed address, and for one over its email limit", async () => {
    await getDb().User.create({ email: "old@example.com", passwordHash: "x", emailConfirmedAt: new Date() });
    const existing = await signUp(post("/api/v1/auth/sign-up", { email: "old@example.com", password: PASSWORD }));
    const again = await signUp(post("/api/v1/auth/sign-up", { email: "old@example.com", password: PASSWORD }));
    expect([existing.status, again.status]).toEqual([202, 202]);
    expect(await existing.json()).toEqual({ ok: true });
    expect(await again.json()).toEqual({ ok: true });
    expect(sendAfterResponse).toHaveBeenCalledTimes(1); // the second was limited, silently
  });

  it("answers 400 with a message per field, and never echoes values", async () => {
    const response = await signUp(post("/api/v1/auth/sign-up", { email: "nope", password: "short", name: "x".repeat(101) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid request",
      fields: { email: "Enter a valid email address.", password: "At least 10 characters.", name: "At most 100 characters." },
    });
    expect(sendAfterResponse).not.toHaveBeenCalled();
  });

  it("answers 400 for a missing or malformed body", async () => {
    expect((await signUp(post("/api/v1/auth/sign-up", "not json"))).status).toBe(400);
    expect((await signUp(post("/api/v1/auth/sign-up", []))).status).toBe(400);
    expect((await signUp(post("/api/v1/auth/sign-up", { email: 5, password: {} }))).status).toBe(400);
  });

  it("answers 403 for a cross-origin or origin-less request and creates nothing", async () => {
    const body = { email: "a@example.com", password: PASSWORD };
    expect((await signUp(post("/api/v1/auth/sign-up", body, { origin: "https://evil.example" }))).status).toBe(403);
    const noOrigin = new NextRequest(`${ORIGIN}/api/v1/auth/sign-up`, { method: "POST", body: JSON.stringify(body) });
    expect((await signUp(noOrigin)).status).toBe(403);
    expect(await getDb().User.count()).toBe(0);
  });

  it("answers 429 with Retry-After after 5 sign-ups from one IP", async () => {
    const headers = { "x-forwarded-for": "203.0.113.50" };
    for (let i = 0; i < 5; i++) {
      const ok = await signUp(post("/api/v1/auth/sign-up", { email: `u${i}@example.com`, password: PASSWORD }, headers));
      expect(ok.status).toBe(202);
    }
    const limited = await signUp(post("/api/v1/auth/sign-up", { email: "u9@example.com", password: PASSWORD }, headers));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("cache-control")).toBe("no-store");
    const retry = Number(limited.headers.get("retry-after"));
    expect(retry).toBeGreaterThan(0);
    expect(await limited.json()).toEqual({ error: "Too many attempts", retryAfterSeconds: retry });
  });
});

describe("POST /api/v1/auth/confirm", () => {
  it("confirms with 200 once, then answers 400 invalid_token", async () => {
    await signUp(post("/api/v1/auth/sign-up", { email: "a@example.com", password: PASSWORD }));
    const token = await tokenFor("a@example.com");

    const ok = await confirm(post("/api/v1/auth/confirm", { token }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(ok.headers.get("set-cookie")).toBeNull();
    expect(await ok.json()).toEqual({ ok: true });

    const reused = await confirm(post("/api/v1/auth/confirm", { token }));
    expect(reused.status).toBe(400);
    expect(await reused.json()).toEqual({ error: "Invalid or expired link", code: "invalid_token" });
  });

  it("answers 400 for a missing or unknown token and 403 cross-origin", async () => {
    expect((await confirm(post("/api/v1/auth/confirm", {}))).status).toBe(400);
    expect((await confirm(post("/api/v1/auth/confirm", { token: "unknown" }))).status).toBe(400);
    expect((await confirm(post("/api/v1/auth/confirm", { token: "x" }, { origin: "https://evil.example" }))).status).toBe(403);
  });
});

describe("POST /api/v1/auth/resend-confirmation", () => {
  it("answers 202 for an unconfirmed, a confirmed and an unknown address alike", async () => {
    await signUp(post("/api/v1/auth/sign-up", { email: "a@example.com", password: PASSWORD }));
    await getDb().User.create({ email: "done@example.com", passwordHash: "x", emailConfirmedAt: new Date() });
    // Free the unconfirmed address from the one-a-minute limit that sign-up started.
    await getDb().RateLimitEvent.update({ createdAt: new Date(Date.now() - 5 * 60_000) }, { where: {} });
    sendAfterResponse.mockClear();

    for (const email of ["a@example.com", "done@example.com", "nobody@example.com"]) {
      const response = await resend(post("/api/v1/auth/resend-confirmation", { email }));
      expect(response.status).toBe(202);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ ok: true });
    }
    expect(sendAfterResponse).toHaveBeenCalledTimes(1);
  });

  it("answers 400, 403 and 429 (with Retry-After)", async () => {
    expect((await resend(post("/api/v1/auth/resend-confirmation", { email: "nope" }))).status).toBe(400);
    expect((await resend(post("/api/v1/auth/resend-confirmation", { email: "a@example.com" }, { origin: "https://evil.example" }))).status).toBe(403);

    await resend(post("/api/v1/auth/resend-confirmation", { email: "nobody@example.com" }));
    const limited = await resend(post("/api/v1/auth/resend-confirmation", { email: "nobody@example.com" }));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await limited.json()).toMatchObject({ error: "Too many attempts" });
  });
});

describe("POST /api/v1/auth/sign-in with an unconfirmed account", () => {
  it("answers 403 email_not_confirmed after a correct password, with no cookies", async () => {
    await getDb().User.create({ email: "a@example.com", passwordHash: await hash(PASSWORD) });
    const response = await signIn(post("/api/v1/auth/sign-in", { email: "a@example.com", password: PASSWORD }));
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({ error: "Email not confirmed", code: "email_not_confirmed" });

    const wrong = await signIn(post("/api/v1/auth/sign-in", { email: "a@example.com", password: "wrong-password-here" }));
    expect(wrong.status).toBe(401);
  });
});

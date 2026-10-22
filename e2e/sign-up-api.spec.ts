import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

// playwright.config.ts starts the server with MAIL_DRIVER=log and MAIL_LOG_FILE, so the emails the
// server "sends" can be read here. Sign-up is limited to 5 per IP per hour, so every test sends
// its own x-forwarded-for, and the spec runs in one project only (the API does not depend on it).
test.beforeEach(({ request }, testInfo) => {
  void request;
  test.skip(testInfo.project.name !== "desktop", "API spec: run once");
});

// Must match playwright.config.ts.
const MAIL_LOG_FILE = path.join(os.tmpdir(), `ua-e2e-mail-${process.env.PLAYWRIGHT_PORT ?? 3100}.jsonl`);

const PASSWORD = "e2e-long-enough-password";

const unique = () => `e2e.${randomBytes(6).toString("hex")}@example.com`;
const ownIp = () => `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}`;

type Mail = { to: string; subject: string; text: string };

async function waitForMail(to: string, subject: string): Promise<Mail> {
  for (let i = 0; i < 60; i++) {
    const lines = (await fs.readFile(MAIL_LOG_FILE, "utf8").catch(() => "")).split("\n").filter(Boolean);
    const found = lines.map((line) => JSON.parse(line) as Mail).find((mail) => mail.to === to && mail.subject === subject);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No "${subject}" email for ${to} was sent`);
}

function tokenOf(mail: Mail, baseURL: string): string {
  const match = mail.text.match(/\/confirm-email\?token=([A-Za-z0-9_-]+)/);
  expect(match, "the email holds a confirmation link").toBeTruthy();
  expect(mail.text).toContain(`${baseURL}/confirm-email?token=`);
  return match![1];
}

test("sign up, confirm by link, then sign in", async ({ request, baseURL }) => {
  const headers = { origin: baseURL!, "x-forwarded-for": ownIp() };
  const email = unique();

  const signUp = await request.post("/api/v1/auth/sign-up", { headers, data: { email, password: PASSWORD, name: "E2E" } });
  expect(signUp.status()).toBe(202);
  expect(signUp.headers()["cache-control"]).toBe("no-store");
  expect(await signUp.json()).toEqual({ ok: true });

  // Not confirmed yet: the right password is refused, with no session.
  const early = await request.post("/api/v1/auth/sign-in", { headers, data: { email, password: PASSWORD } });
  expect(early.status()).toBe(403);
  expect(await early.json()).toEqual({ error: "Email not confirmed", code: "email_not_confirmed" });
  expect(early.headers()["set-cookie"]).toBeUndefined();

  const token = tokenOf(await waitForMail(email, "Confirm your email"), baseURL!);

  const confirm = await request.post("/api/v1/auth/confirm", { headers, data: { token } });
  expect(confirm.status()).toBe(200);
  expect(await confirm.json()).toEqual({ ok: true });
  expect(confirm.headers()["set-cookie"]).toBeUndefined(); // confirms only; no session

  const signIn = await request.post("/api/v1/auth/sign-in", { headers, data: { email, password: PASSWORD } });
  expect(signIn.status()).toBe(200);

  // The same link cannot be used twice.
  const again = await request.post("/api/v1/auth/confirm", { headers, data: { token } });
  expect(again.status()).toBe(400);
  expect(await again.json()).toEqual({ error: "Invalid or expired link", code: "invalid_token" });
});

test("a confirmed address gets the same answer and an already-registered email", async ({ request, baseURL }) => {
  const headers = { origin: baseURL!, "x-forwarded-for": ownIp() };
  const email = unique();
  await request.post("/api/v1/auth/sign-up", { headers, data: { email, password: PASSWORD } });
  const token = tokenOf(await waitForMail(email, "Confirm your email"), baseURL!);
  expect((await request.post("/api/v1/auth/confirm", { headers, data: { token } })).status()).toBe(200);

  const second = await request.post("/api/v1/auth/sign-up", {
    headers: { ...headers, "x-forwarded-for": ownIp() },
    data: { email, password: "someone-elses-long-password" },
  });
  expect(second.status()).toBe(202);
  expect(await second.json()).toEqual({ ok: true });
  // The confirmation-email limit (once a minute) skips a second email so soon after the first, so
  // the "already registered" email is covered in Vitest; here the password must be unchanged.
  const signIn = await request.post("/api/v1/auth/sign-in", { headers, data: { email, password: PASSWORD } });
  expect(signIn.status()).toBe(200);
});

test("unknown tokens and invalid input are refused", async ({ request, baseURL }) => {
  const headers = { origin: baseURL!, "x-forwarded-for": ownIp() };
  const unknown = await request.post("/api/v1/auth/confirm", { headers, data: { token: "not-a-real-token" } });
  expect(unknown.status()).toBe(400);

  const invalid = await request.post("/api/v1/auth/sign-up", { headers, data: { email: "nope", password: "short" } });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({
    error: "Invalid request",
    fields: { email: expect.any(String), password: "At least 10 characters." },
  });
});

test("resend answers 202 for an unknown address", async ({ request, baseURL }) => {
  const headers = { origin: baseURL!, "x-forwarded-for": ownIp() };
  const response = await request.post("/api/v1/auth/resend-confirmation", { headers, data: { email: unique() } });
  expect(response.status()).toBe(202);
  expect(await response.json()).toEqual({ ok: true });
});

test("cross-origin requests are refused", async ({ request }) => {
  const headers = { origin: "https://evil.example", "x-forwarded-for": ownIp() };
  for (const [path, data] of [
    ["/api/v1/auth/sign-up", { email: unique(), password: PASSWORD }],
    ["/api/v1/auth/confirm", { token: "x" }],
    ["/api/v1/auth/resend-confirmation", { email: unique() }],
  ] as const) {
    const response = await request.post(path, { headers, data });
    expect(response.status(), path).toBe(403);
  }
});

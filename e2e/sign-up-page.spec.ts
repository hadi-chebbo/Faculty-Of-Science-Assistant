import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// The sign-up screens. Sign-up is limited to 5 per IP per hour and every request comes from
// localhost, so each test sends its own x-forwarded-for and uses its own random address.
// One-a-minute confirmation emails are a backend limit: tests that need a second email move that
// address's recorded sends back in time in the database (as if a minute had passed).
test.beforeEach(async ({ page }) => {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
});

// Must match playwright.config.ts.
const MAIL_LOG_FILE = path.join(os.tmpdir(), `ua-e2e-mail-${process.env.PLAYWRIGHT_PORT ?? 3100}.jsonl`);
const PASSWORD = "e2e-long-enough-password";
const unique = () => `e2e.${randomBytes(6).toString("hex")}@example.com`;

type Mail = { to: string; subject: string; text: string };

async function mailsFor(to: string): Promise<Mail[]> {
  const lines = (await fs.readFile(MAIL_LOG_FILE, "utf8").catch(() => "")).split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line) as Mail).filter((mail) => mail.to === to && mail.subject === "Confirm your email");
}

async function waitForMails(to: string, count: number): Promise<Mail[]> {
  for (let i = 0; i < 60; i++) {
    const mails = await mailsFor(to);
    if (mails.length >= count) return mails;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Expected ${count} confirmation email(s) for ${to}`);
}

function linkOf(mail: Mail): string {
  const match = mail.text.match(/https?:\/\/\S+\/confirm-email\?token=[A-Za-z0-9_-]+/);
  expect(match, "the email holds a confirmation link").toBeTruthy();
  return match![0];
}

async function signUp(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/sign-up\/check-email$/);
}

async function allowAnotherEmail(email: string) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      "update rate_limit_events set created_at = created_at - interval '10 minutes' where action = 'confirmation-email' and subject = $1",
      [email],
    );
  } finally {
    await client.end();
  }
}

test("sign up, confirm by the emailed link, then sign in", async ({ page }) => {
  const email = unique();
  await signUp(page, email);
  expect(page.url()).not.toContain("e2e.");
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  const masked = `${email[0]}•••@example.com`;
  await expect(page.getByText(`We sent a confirmation link to ${masked}.`)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Send a new link \(\d+ s\)$/ })).toBeDisabled();

  const [mail] = await waitForMails(email, 1);
  await page.goto(linkOf(mail));
  await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible();
  await expect(page).toHaveURL(/\/confirm-email$/); // the token is gone from the address bar
  expect(page.url()).not.toContain("token");

  await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("a password under 10 characters is refused in the browser and the hint is visible", async ({ page }) => {
  await page.goto("/sign-up");
  const password = page.getByLabel("Password", { exact: true });
  await expect(page.getByText("At least 10 characters.")).toBeVisible();
  await expect(password).toHaveAttribute("aria-describedby", /password-hint/);
  await page.getByLabel("Email").fill(unique());
  await password.fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(password).toHaveJSProperty("validity.tooShort", true);
  await expect(page.getByText("At least 10 characters.")).toBeVisible();
});

test("signing in before confirming offers a new link, once the one-a-minute limit allows it", async ({ page }) => {
  const email = unique();
  await signUp(page, email);
  await waitForMails(email, 1);

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(`Confirm your email first. We sent a link to ${email[0]}•••@example.com.`)).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(PASSWORD);

  // The sign-up email was sent seconds ago, so the backend refuses another one for now.
  await page.getByRole("button", { name: "Send a new link" }).click();
  await expect(page.getByText("Please wait before asking for another link.")).toBeVisible();
  expect(await mailsFor(email)).toHaveLength(1);

  await allowAnotherEmail(email);
  await page.getByRole("button", { name: "Send a new link" }).click();
  await expect(page.getByText("A new link is on its way.")).toBeVisible();
  await waitForMails(email, 2);
});

test("a link that was already used says it can't be used, and offers a new one", async ({ page }) => {
  const email = unique();
  await signUp(page, email);
  const [mail] = await waitForMails(email, 1);
  const link = linkOf(mail);

  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible();

  await page.goto(link);
  await expect(page.getByRole("heading", { name: "This link can't be used" })).toBeVisible();
  await expect(page).toHaveURL(/\/confirm-email$/);
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send a new link" })).toBeEnabled();
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("opening /confirm-email without a token says the link can't be used", async ({ page }) => {
  await page.goto("/confirm-email");
  await expect(page.getByRole("heading", { name: "This link can't be used" })).toBeVisible();
});

test("the check-email page opened directly asks for the address", async ({ page }) => {
  await page.goto("/sign-up/check-email");
  await expect(page.getByText("We sent a confirmation link to your email address.")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await page.getByRole("link", { name: "Wrong email? Start again" }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
});

test("the sign-in and sign-up pages link to each other", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("the sign-up page fits a phone and shows the brand panel only on desktop", async ({ page, isMobile }) => {
  await page.goto("/sign-up");
  const panel = page.getByTestId("auth-panel");
  if (isMobile) await expect(panel).toBeHidden();
  else await expect(panel).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const button = await page.getByRole("button", { name: "Create account" }).boundingBox();
  expect(button!.height).toBeGreaterThanOrEqual(44);
});

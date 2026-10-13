import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

// Needs the demo data and an admin: SEED_DEMO_DATA=true ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: CI passes the variables in the environment.
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const STUDENT_EMAIL = "demo.student@example.com"; // from the demo seed
const STUDENT_PASSWORD = "demo-student-password";

test.beforeAll(() => {
  expect(ADMIN_EMAIL && ADMIN_PASSWORD, "ADMIN_EMAIL and ADMIN_PASSWORD must be set").toBeTruthy();
});

// Each test gets its own client address so the sign-in rate limit cannot couple tests.
async function ownAddress(page: Page) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname !== "/sign-in");
}

const accountButton = (page: Page) => page.locator('header button[aria-haspopup="menu"]');
const signInLink = (page: Page) => page.locator("header").getByRole("link", { name: "Sign in" });

test("a signed-out visitor sees a Sign in link that leads to /sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(signInLink(page)).toBeVisible();
  await expect(accountButton(page)).toHaveCount(0);
  await signInLink(page).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("a signed-out visitor costs exactly one request to /api/v1/auth/me and none to refresh", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/v1/auth/")) calls.push(path);
  });
  await page.goto("/");
  await expect(signInLink(page)).toBeVisible();
  expect(calls).toEqual(["/api/v1/auth/me"]);
});

test("the admin sees an account button, never their email, and a menu with Admin and Sign out", async ({ page }) => {
  await ownAddress(page);
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto("/");
  await expect(accountButton(page)).toBeVisible();
  await expect(signInLink(page)).toHaveCount(0);
  expect(await page.content()).not.toContain(ADMIN_EMAIL);

  await accountButton(page).click();
  await expect(page.getByRole("menuitem", { name: "Admin" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  expect(await page.content()).not.toContain(ADMIN_EMAIL);
});

test("the demo student sees their name and no Admin item, and lands on the home page", async ({ page }) => {
  await ownAddress(page);
  await signIn(page, STUDENT_EMAIL, STUDENT_PASSWORD);
  await expect(page).toHaveURL(/\/$/);
  await expect(accountButton(page)).toHaveText("Demo Student");
  await accountButton(page).click();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Admin" })).toHaveCount(0);
});

test("signing out from the menu on a public page returns to Sign in", async ({ page }) => {
  await ownAddress(page);
  await signIn(page, STUDENT_EMAIL, STUDENT_PASSWORD);
  await page.goto("/courses/DEMO301");
  await accountButton(page).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(signInLink(page)).toBeVisible();
  await expect(accountButton(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/courses\/DEMO301$/);
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "ua_access" && c.value)).toBeUndefined();
});

test("an expired access cookie is renewed from the refresh cookie by the header", async ({ page }) => {
  await ownAddress(page);
  await signIn(page, STUDENT_EMAIL, STUDENT_PASSWORD);
  await page.context().clearCookies({ name: "ua_access" });
  await page.goto("/");
  await expect(accountButton(page)).toHaveText("Demo Student");
});

test("GET /api/v1/auth/me without cookies is signed out, and never contains an email when signed in", async ({
  page,
  request,
}) => {
  const anonymous = await request.get("/api/v1/auth/me");
  expect(anonymous.status()).toBe(200);
  expect(anonymous.headers()["cache-control"]).toBe("no-store");
  expect(await anonymous.json()).toEqual({ user: null, renewable: false });

  await ownAddress(page);
  await signIn(page, STUDENT_EMAIL, STUDENT_PASSWORD);
  const signedIn = await page.request.get("/api/v1/auth/me");
  const text = await signedIn.text();
  expect(JSON.parse(text)).toEqual({ user: { name: "Demo Student", role: "student" }, renewable: false });
  expect(text).not.toContain("@");
});

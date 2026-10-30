import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

// Needs the demo data and an admin, like e2e/auth.spec.ts. Other specs create users while this one runs,
// so it looks for its own unique addresses and never asserts totals.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: CI passes the variables in the environment.
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

test.beforeAll(() => {
  expect(ADMIN_EMAIL && ADMIN_PASSWORD, "ADMIN_EMAIL and ADMIN_PASSWORD must be set").toBeTruthy();
});

const octet = () => randomBytes(1)[0];
const ownIp = () => `10.${octet()}.${octet()}.${octet()}`;

// Each test gets its own client address so sign-ins cannot rate-limit each other.
async function ownAddress(page: Page) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ownIp() });
}

async function signIn(page: Page, email: string, password: string) {
  await ownAddress(page);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

test("the admin opens Users, searches and filters unconfirmed accounts", async ({ page, request, baseURL }) => {
  const stamp = randomBytes(5).toString("hex");
  const email = `e2e.users.${stamp}@example.com`;
  const signUp = await request.post("/api/v1/auth/sign-up", {
    headers: { origin: baseURL!, "x-forwarded-for": ownIp() },
    data: { email, password: "e2e-long-enough-password", name: "Users Spec" },
  });
  expect(signUp.status()).toBe(202);

  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto("/admin");
  await page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Users" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Users", exact: true })).toHaveAttribute("aria-current", "page");

  // The seeded admin and demo student, found by searching (the list is paged).
  await page.getByLabel("Email").fill(ADMIN_EMAIL.slice(0, 6));
  await page.getByRole("button", { name: "Search" }).click();
  const adminRow = page.getByRole("listitem").filter({ hasText: ADMIN_EMAIL.toLowerCase() });
  await expect(adminRow).toBeVisible();
  await expect(adminRow).toContainText("Admin");
  await expect(adminRow.getByText("Confirmed", { exact: true })).toBeVisible();

  await page.getByLabel("Email").fill("DEMO.STUDENT@");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/admin\/users\?q=DEMO\.STUDENT%40$/);
  const student = page.getByRole("listitem").filter({ hasText: "demo.student@example.com" });
  await expect(student).toBeVisible();
  await expect(student).toContainText("Student");

  // Our new account: unconfirmed, never signed in.
  await page.getByLabel("Email").fill(stamp);
  await page.getByRole("button", { name: "Search" }).click();
  const mine = page.getByRole("listitem").filter({ hasText: email });
  await expect(mine).toBeVisible();
  await expect(mine.getByText("Unconfirmed", { exact: true })).toBeVisible();
  await expect(mine.getByText("Never")).toBeVisible();

  // The checkbox combines with the search and lives in the address.
  await page.getByLabel("Unconfirmed only").check();
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(new RegExp(`\\?q=${stamp}&status=unconfirmed$`));
  await expect(page.getByRole("listitem").filter({ hasText: email })).toBeVisible();

  // The confirmed demo student is not unconfirmed.
  await page.goto("/admin/users?q=demo.student&status=unconfirmed");
  await expect(page.getByText("No users match.")).toBeVisible();
  await page.getByRole("link", { name: "Clear the search" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);

  // Unusable values are ignored.
  await page.goto("/admin/users?status=blocked&page=zero");
  await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
});

test("the admin opens a user from the list and goes back to the same list", async ({ page, request, baseURL }) => {
  const stamp = randomBytes(5).toString("hex");
  const email = `e2e.detail.${stamp}@example.com`;
  const signUp = await request.post("/api/v1/auth/sign-up", {
    headers: { origin: baseURL!, "x-forwarded-for": ownIp() },
    data: { email, password: "e2e-long-enough-password", name: "Detail Spec" },
  });
  expect(signUp.status()).toBe(202);

  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/admin/users?q=${stamp}&status=unconfirmed`);
  await page.getByRole("link", { name: email }).click();
  await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}\?/);
  await expect(page.getByRole("heading", { name: email, level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toBeVisible();

  const account = page.getByRole("region", { name: "Account" });
  await expect(account).toContainText("Detail Spec");
  await expect(account).toContainText("Student");
  await expect(account.getByText("Unconfirmed", { exact: true })).toBeVisible();
  await expect(account).toContainText("Never");
  const activity = page.getByRole("region", { name: "Activity" });
  for (const label of ["Saved resources", "To-do cards", "Completions", "Milestones", "Active days"]) {
    await expect(activity.locator("div").filter({ hasText: label }).first()).toContainText("0");
  }
  const security = page.getByRole("region", { name: "Security" });
  await expect(security).toContainText("Open sessions");
  await expect(security).toContainText("None in the last 7 days");

  await page.getByRole("link", { name: "‹ Users" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/users\\?q=${stamp}&status=unconfirmed$`));
  await expect(page.getByRole("listitem").filter({ hasText: email })).toBeVisible();
});

test("the admin confirms a user's email by hand and the user can then sign in", async ({ page, browser, request, baseURL }) => {
  const stamp = randomBytes(5).toString("hex");
  const email = `e2e.confirm.${stamp}@example.com`;
  const password = "e2e-long-enough-password";
  const signUp = await request.post("/api/v1/auth/sign-up", {
    headers: { origin: baseURL!, "x-forwarded-for": ownIp() },
    data: { email, password, name: "Confirm Spec" },
  });
  expect(signUp.status()).toBe(202);

  const refused = await request.post("/api/v1/auth/sign-in", {
    headers: { origin: baseURL!, "x-forwarded-for": ownIp() },
    data: { email, password },
  });
  expect(refused.status()).toBe(403);

  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/admin/users?q=${stamp}`);
  await page.getByRole("link", { name: email }).click();
  const account = page.getByRole("region", { name: "Account" });
  await expect(account.getByText("Unconfirmed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirm email" }).click();
  await expect(page.getByText("Email confirmed.")).toBeVisible();
  await expect(account).toContainText("Confirmed");
  await expect(account.getByText("Unconfirmed", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirm email" })).toHaveCount(0);

  const context = await browser.newContext({ baseURL });
  try {
    const userPage = await context.newPage();
    await signIn(userPage, email, password);
    expect(new URL(userPage.url()).pathname).toBe("/");
  } finally {
    await context.close();
  }
});

test("an unknown or malformed user id is the 404 page", async ({ page }) => {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  for (const id of ["33333333-3333-4333-8333-333333333333", "not-a-uuid"]) {
    await page.goto(`/admin/users/${id}`);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  }
});

test("a student is refused the users page", async ({ page }) => {
  await signIn(page, "demo.student@example.com", "demo-student-password");
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toHaveCount(0);
  await page.goto("/admin/users/33333333-3333-4333-8333-333333333333");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("a signed-out visitor to /admin/users ends on /sign-in", async ({ page }) => {
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Fusers[^&]*$/);
});

test("a phone shows stacked rows without sideways scrolling", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "phone only");
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto("/admin/users");
  await expect(page.getByRole("listitem").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

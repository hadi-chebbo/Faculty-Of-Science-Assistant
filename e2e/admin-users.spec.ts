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

test("a student is refused the users page", async ({ page }) => {
  await signIn(page, "demo.student@example.com", "demo-student-password");
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toHaveCount(0);
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

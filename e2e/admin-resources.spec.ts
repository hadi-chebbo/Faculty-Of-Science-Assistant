import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

// Needs the demo data and an admin, like e2e/auth.spec.ts.
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

// Each test gets its own client address so sign-ins cannot rate-limit each other.
async function ownAddress(page: Page) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
}

async function signInAsAdmin(page: Page) {
  await ownAddress(page);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin$/);
}

test("a signed-out visitor to /admin ends on /sign-in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("the admin sees drafts and published rows, filtered by course", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin?course=DEMO501");

  const draft = page.getByRole("listitem").filter({ hasText: "Sample draft lecture" });
  await expect(draft).toBeVisible();
  await expect(draft.getByText("Draft", { exact: true })).toBeVisible();

  const published = page.getByRole("listitem").filter({ hasText: "Sample lecture 1" });
  await expect(published.getByText("Published", { exact: true })).toBeVisible();

  // Rows from another course are absent.
  await expect(page.getByText("Sample draft notes with no source")).toHaveCount(0);
});

test("choosing a course and applying updates the URL and the list", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin");
  await page.getByLabel("Course").selectOption("DEMO601");
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page).toHaveURL(/\/admin\?course=DEMO601$/);
  await expect(page.getByText("Sample draft notes with no source")).toBeVisible();
  await expect(page.getByText("Sample draft lecture", { exact: true })).toHaveCount(0);
});

test("Next goes to page 2 and shows different rows", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: /next/i })).toBeVisible();
  const firstTitles = await page.getByRole("listitem").locator("p.font-medium").allTextContents();
  expect(firstTitles.length).toBe(20);

  await page.getByRole("link", { name: /next/i }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("link", { name: /previous/i })).toBeVisible();
  const secondTitles = await page.getByRole("listitem").locator("p.font-medium").allTextContents();
  expect(secondTitles.length).toBeGreaterThan(0);
  expect(secondTitles.some((t) => firstTitles.includes(t))).toBe(false);
});

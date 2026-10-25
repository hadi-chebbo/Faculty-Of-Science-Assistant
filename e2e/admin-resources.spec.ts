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
  await page.getByLabel("Password", { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin$/);
}

test("a signed-out visitor to /admin ends on /sign-in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in(\?next=%2Fadmin[^&]*)?$/);
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

// Titles repeat across the demo courses, so the pages are told apart by their number, not by text.
test("Next goes to page 2 and Previous comes back", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin");
  await expect(page.getByText(/page 1 of \d+/)).toBeVisible();
  await expect(page.getByRole("listitem").locator("p.font-medium")).toHaveCount(20);
  await expect(page.getByRole("link", { name: /previous/i })).toHaveCount(0);

  await page.getByRole("link", { name: /next/i }).click();
  await expect(page).toHaveURL(/\/admin\?page=2$/);
  await expect(page.getByText(/page 2 of \d+/)).toBeVisible();
  await expect(page.getByRole("listitem").locator("p.font-medium").first()).toBeVisible();

  await page.getByRole("link", { name: /previous/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText(/page 1 of \d+/)).toBeVisible();
});

test("the admin can open a draft from the list; others get 404", async ({ page, playwright, baseURL }) => {
  await signInAsAdmin(page);
  await page.goto("/admin?course=DEMO501");
  const row = page.getByRole("listitem").filter({ hasText: "Sample draft lecture" });
  const href = await row.getByRole("link", { name: "Open Sample draft lecture" }).getAttribute("href");
  expect(href).toMatch(/^\/api\/v1\/resources\/[0-9a-f-]+\/open$/);

  const asAdmin = await page.request.get(href!, { maxRedirects: 0 });
  expect(asAdmin.status()).toBe(307);
  expect(asAdmin.headers()["location"]).toBeTruthy();

  const anonymous = await playwright.request.newContext({ baseURL });
  const asVisitor = await anonymous.get(href!, { maxRedirects: 0, headers: { accept: "application/json" } });
  expect(asVisitor.status()).toBe(404);
  await anonymous.dispose();
});

test("a signed-in student cannot open a draft", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin?course=DEMO501");
  const href = await page
    .getByRole("listitem")
    .filter({ hasText: "Sample draft lecture" })
    .getByRole("link", { name: "Open Sample draft lecture" })
    .getAttribute("href");
  await page.context().clearCookies();

  await ownAddress(page);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("demo.student@example.com");
  await page.getByLabel("Password", { exact: true }).fill("demo-student-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));

  const response = await page.request.get(href!, { maxRedirects: 0, headers: { accept: "application/json" } });
  expect(response.status()).toBe(404);
});

test("a row with no file or link shows a hint instead of Open", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin?course=DEMO601");
  const row = page.getByRole("listitem").filter({ hasText: "Sample draft notes with no source" });
  await expect(row.getByText("No file or link yet")).toBeVisible();
  await expect(row.getByRole("link", { name: /^Open/ })).toHaveCount(0);
});

test("the admin bar sits above the title and marks the current section", async ({ page }) => {
  await signInAsAdmin(page);
  const nav = page.getByRole("navigation", { name: "Admin sections" });
  const sections = [
    { path: "/admin", current: "Resources", other: "Chapters" },
    { path: "/admin/chapters", current: "Chapters", other: "Resources" },
    { path: "/admin/resources/new", current: "Resources", other: "Chapters" },
  ];
  for (const { path, current, other } of sections) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(nav.getByRole("link", { name: current })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: other })).not.toHaveAttribute("aria-current", "page");
    // The navigation comes before the h1 in document order.
    const navFirst = await nav.evaluate((el) => {
      const h1 = document.querySelector("h1");
      return !!h1 && !!(el.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(navFirst, `${path}: admin navigation is before the h1`).toBe(true);
  }
});

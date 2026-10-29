import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

// Needs the demo data (SEED_DEMO_DATA=true npm run db:seed, STORAGE_DRIVER=local). The empty-state
// test uses a fresh confirmed student per project, created and deleted here.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the connection below fails with a clear error.
  }
}

const DEMO_EMAIL = "demo.student@example.com";
const PASSWORD = "demo-student-password";

async function withDb<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function signIn(page: Page, email: string) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  await page.goto("/sign-in?next=%2F");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

test("the demo student sees up to three courses and See all", async ({ page }) => {
  await signIn(page, DEMO_EMAIL);
  const band = page.locator("section[data-personal]").filter({ has: page.getByRole("heading", { name: "Your progress" }) });
  await expect(band).toBeVisible();
  await expect(band.getByText(/active days? this week|No active days yet this week/)).toBeVisible();
  const rows = band.locator('a[href^="/courses/"]');
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(1);
  expect(count).toBeLessThanOrEqual(3);
  await expect(rows.first().locator("svg").first()).toBeAttached();
  await expect(band.getByRole("link", { name: /See all/ })).toHaveAttribute("href", "/progress");
});

test("a student with no completions sees the empty text", async ({ page, isMobile }) => {
  const email = `home-progress-${isMobile ? "phone" : "desktop"}@example.com`;
  await withDb(async (client) => {
    await client.query(`DELETE FROM users WHERE email = $1`, [email]);
    await client.query(
      `INSERT INTO users (email, name, password_hash, role, email_confirmed_at, created_at, updated_at)
       SELECT $1, 'Home progress', password_hash, 'student', now(), now(), now() FROM users WHERE email = $2`,
      [email, DEMO_EMAIL],
    );
  });
  try {
    await signIn(page, email);
    await expect(page.getByRole("heading", { name: "Your progress" })).toBeVisible();
    await expect(page.getByText("Mark files as done in the reader to track your progress here.")).toBeVisible();
    await expect(page.getByRole("link", { name: /See all/ })).toHaveCount(0);
  } finally {
    await withDb((client) => client.query(`DELETE FROM users WHERE email = $1`, [email]));
  }
});

test("a visitor sees no band and makes no progress request", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Your progress" })).toHaveCount(0);
  expect(requests.filter((url) => url.includes("/api/v1/progress"))).toEqual([]);
});

test("on a phone the page does not overflow sideways with the band shown", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone only");
  for (const width of [360, 412]) {
    await page.setViewportSize({ width, height: 800 });
    await signIn(page, DEMO_EMAIL);
    await expect(page.getByRole("heading", { name: "Your progress" })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBe(width);
    await page.context().clearCookies();
  }
});

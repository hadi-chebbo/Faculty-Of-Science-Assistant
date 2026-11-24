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

async function top(locator: import("@playwright/test").Locator): Promise<number> {
  return locator.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
}

test("on a phone a signed-in student sees progress, the years, then a short hero", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await signIn(page, DEMO_EMAIL);
  const band = page.getByRole("heading", { name: "Your progress" });
  await expect(band).toBeVisible();
  const years = page.getByRole("heading", { name: "Choose your year" });
  const headline = page.getByRole("heading", { level: 1 });
  const strip = page.locator("dl").first();
  expect(await top(band)).toBeLessThan(await top(years));
  expect(await top(years)).toBeLessThan(await top(headline));
  expect(await top(headline)).toBeLessThan(await top(strip));
  // The short hero: the headline and its two buttons only.
  await expect(page.getByText("Stop digging through Drive links.")).toBeHidden();
  await expect(page.getByText("No account needed")).toBeHidden();
  await expect(page.getByTestId("course-preview")).toBeHidden();
  await expect(page.getByRole("link", { name: "Browse courses" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Previous exams" }).first()).toBeVisible();
  await expect(headline).toBeVisible();
});

test("on desktop a signed-in student keeps the order: hero, progress, numbers, years", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout");
  await signIn(page, DEMO_EMAIL);
  const band = page.getByRole("heading", { name: "Your progress" });
  await expect(band).toBeVisible();
  const headline = await top(page.getByRole("heading", { level: 1 }));
  const strip = await top(page.locator("dl").first());
  const years = await top(page.getByRole("heading", { name: "Choose your year" }));
  expect(headline).toBeLessThan(await top(band));
  expect(await top(band)).toBeLessThan(strip);
  expect(strip).toBeLessThan(years);
  await expect(page.getByText("Stop digging through Drive links.")).toBeVisible();
  await expect(page.getByTestId("course-preview")).toBeVisible();
});

test("on a phone the years do not move when the band loads", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await signIn(page, DEMO_EMAIL);
  await expect(page.getByRole("heading", { name: "Your progress" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("home:band-h"))).not.toBeNull();

  // A later visit: the overview is held back, so the first paint has only the reserved space.
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/v1/progress", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const years = page.getByRole("heading", { name: "Choose your year" });
  await expect(years).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your progress" })).toHaveCount(0);
  const before = await top(years);
  release();
  await expect(page.getByRole("heading", { name: "Your progress" })).toBeVisible();
  expect(await top(years)).toBe(before);
});

test("the hint cookie is readable and set on sign-in, and cleared on sign-out", async ({ page, context }) => {
  await signIn(page, DEMO_EMAIL);
  const hint = (await context.cookies()).find((cookie) => cookie.name === "ua_signed_in");
  expect(hint).toMatchObject({ value: "1", httpOnly: false, sameSite: "Lax", path: "/" });
  expect(await page.evaluate(() => document.cookie)).toContain("ua_signed_in=1");
  const refresh = (await context.cookies()).find((cookie) => cookie.name === "ua_refresh");
  expect(hint!.expires).toBeCloseTo(refresh!.expires, -2);

  await page.locator('header button[aria-haspopup="menu"]').click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  // Signing out on Home returns the visitor layout in place (marker removed, band gone).
  await expect(page.getByRole("heading", { name: "Your progress" })).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-signed-in", /.*/);
  await expect(page.getByText("Stop digging through Drive links.")).toBeVisible();
  expect((await context.cookies()).find((cookie) => cookie.name === "ua_signed_in")).toBeUndefined();
});

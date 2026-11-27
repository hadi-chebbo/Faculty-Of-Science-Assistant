import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { samplePdf } from "../src/lib/storage/sample-pdf";

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
    // The band has no "See all" (the page's "Recently added" list has its own, which is not the band's).
    await expect(page.locator("section[data-personal]").getByRole("link", { name: /See all/ })).toHaveCount(0);
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

test("on a phone a signed-in student sees the hero first, then progress, then the years", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await signIn(page, DEMO_EMAIL);
  const band = page.getByRole("heading", { name: "Your progress" });
  await expect(band).toBeVisible();
  const headline = page.getByRole("heading", { level: 1 });
  const years = page.getByRole("heading", { name: "Choose your year" });
  expect(await top(headline)).toBeLessThan(await top(band));
  expect(await top(band)).toBeLessThan(await top(years));
  await expect(page.getByRole("searchbox", { name: /Search courses/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Previous exams" }).first()).toBeVisible();
});

test("on desktop a signed-in student keeps the order: hero, progress, years", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout");
  await signIn(page, DEMO_EMAIL);
  const band = page.getByRole("heading", { name: "Your progress" });
  await expect(band).toBeVisible();
  const headline = await top(page.getByRole("heading", { level: 1 }));
  const years = await top(page.getByRole("heading", { name: "Choose your year" }));
  expect(headline).toBeLessThan(await top(band));
  expect(await top(band)).toBeLessThan(years);
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
  await expect(page.getByRole("searchbox", { name: /Search courses/ })).toBeVisible();
  expect((await context.cookies()).find((cookie) => cookie.name === "ua_signed_in")).toBeUndefined();
});

test("a visitor gets no reserved space for the card", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose your year" })).toBeVisible();
  const height = await page.getByTestId("home-band-slot").evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBe(0);
  await expect(page.getByRole("heading", { name: "Continue where you left off" })).toHaveCount(0);
});

test("on desktop the years do not move when the card loads", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout");
  await signIn(page, DEMO_EMAIL);
  await expect(page.getByRole("heading", { name: "Your progress" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("home:band-h-wide"))).not.toBeNull();

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

test("the card shows the short prompt, the week row and no streak when nothing was read", async ({ page }) => {
  await signIn(page, DEMO_EMAIL);
  const card = page.locator("section[data-personal]").filter({ has: page.getByRole("heading", { name: "Continue where you left off" }) });
  await expect(card).toBeVisible();
  await expect(card.getByText("Open any file and you can pick it up here next time.")).toBeVisible();
  await expect(card.getByRole("link", { name: /Resume/ })).toHaveCount(0);
  const week = card.getByRole("list", { name: "This week" });
  await expect(week.getByRole("listitem")).toHaveCount(7);
  await expect(week.getByRole("listitem").filter({ hasText: "today" })).toHaveCount(1);
  await expect(card.getByText(/streak|flame/i)).toHaveCount(0);
});

// The seed files have one page, so these tests store a 12-page file and a resource that points at it
// (in DEMO302, which no other spec marks), and remove both afterwards.
test.describe("continuing where the student left off", () => {
  const PAGES = 12;
  let id = "";
  let key = "";
  let title = "";
  const storageDir = () => path.resolve(process.env.STORAGE_LOCAL_DIR ?? ".storage");

  test.beforeAll(async () => {
    key = `resources/${crypto.randomUUID()}.pdf`;
    title = `Continue test lecture ${crypto.randomUUID().slice(0, 8)}`;
    const file = path.join(storageDir(), ...key.split("/"));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, samplePdf(["CONTINUE TEST", "Twelve pages"], PAGES));
    await fs.writeFile(`${file}.meta.json`, JSON.stringify({ contentType: "application/pdf" }));
    id = await withDb(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO resources (course_id, type, title, language, file_key, is_published)
         SELECT id, 'lecture', $2, 'en', $1, true FROM courses WHERE code = 'DEMO302' RETURNING id`,
        [key, title],
      );
      return rows[0].id as string;
    });
  });

  test.afterAll(async () => {
    await withDb((client) => client.query("DELETE FROM resources WHERE id = $1", [id]));
    const file = path.join(storageDir(), ...key.split("/"));
    await fs.rm(file, { force: true });
    await fs.rm(`${file}.meta.json`, { force: true });
  });

  async function readTo(page: Page, pageNumber: number) {
    await page.goto(`/resources/${id}#page=${pageNumber}`);
    await expect(page.getByRole("img", { name: `Page ${pageNumber} of ${PAGES}` })).toBeVisible();
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), `reader:last-page:${id}`)).toBe(String(pageNumber));
    await expect.poll(() => page.evaluate(() => localStorage.getItem("reader:last-read"))).not.toBeNull();
  }

  const cardOf = (page: Page) =>
    page.locator("section[data-personal]").filter({ has: page.getByRole("heading", { name: "Continue where you left off" }) });

  test("Home names the last file and page, and Resume opens the reader on that page", async ({ page, isMobile }) => {
    await signIn(page, DEMO_EMAIL);
    await readTo(page, 5);
    // The address no longer carries the hash once it has been used.
    expect(new URL(page.url()).hash).toBe("");

    await page.goto("/");
    const card = cardOf(page);
    await expect(card.getByText(title)).toBeVisible();
    await expect(card.getByText("DEMO302 · Lecture · Page 5")).toBeVisible();
    // Opening a file never produces a progress number on the card's continue part.
    expect(await card.getByTestId("home-continue").innerText()).not.toContain("%");

    const resume = card.getByRole("link", { name: `Resume ${title}, page 5` });
    await expect(resume).toHaveAttribute("href", `/resources/${id}#page=5`);
    await resume.click();
    await expect(page).toHaveURL(new RegExp(`/resources/${id}$`));
    await expect(page.getByRole("img", { name: `Page 5 of ${PAGES}` })).toBeInViewport();
    if (isMobile) await expect(page.getByRole("group", { name: "Page and zoom" })).toContainText(`5 / ${PAGES}`);
    else await expect(page.getByLabel("Page number")).toHaveValue("5");
    await expect(page.getByRole("region", { name: "Continue reading" })).toHaveCount(0);
  });

  test("a file read only on its first page is resumed without a page", async ({ page }) => {
    await signIn(page, DEMO_EMAIL);
    await page.goto(`/resources/${id}`);
    await expect(page.getByRole("img", { name: `Page 1 of ${PAGES}` })).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("reader:last-read"))).not.toBeNull();
    await page.evaluate((k) => localStorage.removeItem(k), `reader:last-page:${id}`);
    await page.goto("/");
    const card = cardOf(page);
    await expect(card.getByText("DEMO302 · Lecture", { exact: true })).toBeVisible();
    await expect(card.getByRole("link", { name: `Resume ${title}` })).toHaveAttribute("href", `/resources/${id}`);
  });

  test("a hash that is not a page inside the file is ignored", async ({ page }) => {
    await page.goto(`/resources/${id}#page=99`);
    await expect(page.getByRole("img", { name: `Page 1 of ${PAGES}` })).toBeVisible();
    await expect(page.getByRole("img", { name: `Page 1 of ${PAGES}` })).toBeInViewport();
  });

  test("signing out forgets the last file", async ({ page }) => {
    await signIn(page, DEMO_EMAIL);
    await readTo(page, 3);
    await page.goto("/");
    await expect(cardOf(page).getByText(title)).toBeVisible();
    await page.locator('header button[aria-haspopup="menu"]').click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: "Continue where you left off" })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("reader:last-read"))).toBeNull();
  });

  test("signing in forgets a file read before, so a shared browser never shows it to the next person", async ({ page }) => {
    await readTo(page, 4);
    await signIn(page, DEMO_EMAIL);
    const card = cardOf(page);
    await expect(card.getByText("Open any file and you can pick it up here next time.")).toBeVisible();
    await expect(card.getByText(title)).toHaveCount(0);
  });

  test("on a phone nothing overflows and every target and text in the card is big enough", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, DEMO_EMAIL);
    await readTo(page, 5);
    await page.goto("/");
    const card = cardOf(page);
    await expect(card.getByRole("link", { name: /^Resume/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    for (const link of [card.getByRole("link", { name: /^Resume/ }), card.getByRole("link", { name: /See all/ }), ...(await card.locator('a[href^="/courses/"]').all())]) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const smallest = await card.evaluate((root) => {
      let min = Infinity;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim() || !node.parentElement) continue;
        const el = node.parentElement;
        if (el.closest(".sr-only")) continue;
        min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
      }
      return min;
    });
    expect(smallest).toBeGreaterThanOrEqual(12);
  });
});

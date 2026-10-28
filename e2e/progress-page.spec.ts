import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed (with STORAGE_DRIVER=local). The demo
// student is seeded with completions in DEMO610 (chapter 1 finished, two files of chapter 2, one
// exam) and DEMO410; no spec marks files in those courses.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the connection below fails with a clear error.
  }
}

const DEMO_EMAIL = "demo.student@example.com";
const PASSWORD = "demo-student-password";

// Desktop and phone run at the same time; the empty-state test uses a fresh student per project.
test.describe.configure({ mode: "serial" });

async function withDb<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

const emptyEmail = (isMobile: boolean) => `progress-page-${isMobile ? "phone" : "desktop"}@example.com`;

async function ownAddress(page: Page) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
}

async function signInTo(page: Page, next: string, email = DEMO_EMAIL) {
  await ownAddress(page);
  await page.goto("/sign-in?next=" + encodeURIComponent(next));
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(next);
}

test("the demo student sees their courses by semester with rings and chapter rows", async ({ page, isMobile }) => {
  await signInTo(page, "/progress");
  await expect(page.getByRole("heading", { level: 1, name: "Your progress" })).toBeVisible();
  await expect(page.getByText("Based only on the files you marked as done.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Semester 6" })).toBeVisible();

  const card = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "DEMO610 Sample Full Course D" }) });
  await expect(card.getByRole("link", { name: "DEMO610 Sample Full Course D" })).toHaveAttribute("href", "/courses/DEMO610");
  await expect(card.getByRole("img", { name: /^\d+% done, 6 of \d+ files$/ })).toBeVisible();
  await expect(card).toContainText(/6 of \d+ files/);
  await expect(card).toContainText(/Exams: 1 of \d+ done/);
  // Chapter 1 is finished (all four counted files), chapter 2 is under way.
  await expect(card).toContainText("1 · Sample chapter 1");
  await expect(card).toContainText("4/4");
  await expect(card).toContainText(/2 · Sample chapter 2/);
  await expect(card).toContainText(/2\/\d+/);
  await expect(page.getByRole("heading", { level: 2, name: "Semester 4" })).toBeVisible();
  if (!isMobile) {
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Progress");
  }
});

test("a student with nothing marked sees the empty state", async ({ page, isMobile }) => {
  const email = emptyEmail(isMobile);
  await withDb(async (client) => {
    await client.query(`DELETE FROM users WHERE email = $1`, [email]);
    await client.query(
      `INSERT INTO users (email, name, password_hash, role, email_confirmed_at, created_at, updated_at)
       SELECT $1, 'Empty Progress', password_hash, 'student', now(), now(), now() FROM users WHERE email = $2`,
      [email, DEMO_EMAIL],
    );
  });
  try {
    await signInTo(page, "/progress", email);
    await expect(page.getByText("Nothing marked as done yet. Open a file and press Mark as done to see your progress here.")).toBeVisible();
    await page.getByRole("link", { name: "Browse courses" }).first().click();
    await expect(page).toHaveURL("/");
  } finally {
    await withDb((client) => client.query(`DELETE FROM users WHERE email = $1`, [email]));
  }
});

test("a visitor is sent to sign-in and back", async ({ page }) => {
  await ownAddress(page);
  await page.goto("/progress");
  await expect(page).toHaveURL("/sign-in?next=%2Fprogress");
  await page.getByLabel("Email").fill(DEMO_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/progress");
});

test("Progress is in the desktop navigation only", async ({ page, isMobile }) => {
  await signInTo(page, "/progress");
  const main = page.getByRole("navigation", { name: "Main" });
  if (isMobile) {
    await expect(main.getByRole("link", { name: "Progress", exact: true })).toHaveCount(0);
    await expect(main.getByRole("link", { name: "To-do", exact: true })).toBeVisible();
  } else {
    const item = main.getByRole("link", { name: "Progress", exact: true });
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute("aria-current", "page");
    await page.goto("/");
    await expect(item).not.toHaveAttribute("aria-current", "page");
  }
});

test("a semester page rings the started courses for the student, and nothing for a visitor", async ({ page, browser, baseURL }) => {
  await signInTo(page, "/semesters/6");
  const ring = page.getByRole("img", { name: /^Your progress: \d+% done$/ });
  await expect(ring).toHaveCount(1);
  const card = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: /DEMO610/ }) });
  await expect(card.getByRole("img", { name: /^Your progress/ })).toBeVisible();

  const visitor = await browser.newContext({ baseURL });
  try {
    const anon = await visitor.newPage();
    const requests: string[] = [];
    anon.on("request", (request) => requests.push(request.url()));
    await anon.goto("/semesters/6");
    await expect(anon.getByRole("link", { name: /DEMO610/ })).toBeVisible();
    await anon.waitForLoadState("networkidle");
    await expect(anon.getByRole("img", { name: /^Your progress/ })).toHaveCount(0);
    expect(requests.filter((url) => url.includes("/api/v1/progress"))).toEqual([]);
  } finally {
    await visitor.close();
  }
});

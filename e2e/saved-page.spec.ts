import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed (with STORAGE_DRIVER=local).
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the connection below fails with a clear error.
  }
}

const DEMO_EMAIL = "demo.student@example.com"; // from the demo seed; its password hash is copied
const PASSWORD = "demo-student-password";

// The two projects (desktop, phone) run at the same time. The demo student already has saved files
// from the seed, so each project signs in as its own fresh student with nothing saved; the tests
// of one project run one after the other.
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

const emailFor = (isMobile: boolean) => `saved-page-${isMobile ? "phone" : "desktop"}@example.com`;

async function resourceId(courseCode: string, title: string): Promise<string> {
  return withDb(async (client) => {
    const { rows } = await client.query(
      `SELECT r.id FROM resources r JOIN courses c ON c.id = r.course_id WHERE c.code = $1 AND r.title = $2`,
      [courseCode, title],
    );
    expect(rows).toHaveLength(1);
    return rows[0].id;
  });
}

test.beforeEach(async ({ isMobile }) => {
  await withDb(async (client) => {
    await client.query(`DELETE FROM users WHERE email = $1`, [emailFor(isMobile)]);
    await client.query(
      `INSERT INTO users (email, name, password_hash, role, email_confirmed_at, created_at, updated_at)
       SELECT $1, 'Saved Tester', password_hash, 'student', now(), now(), now() FROM users WHERE email = $2`,
      [emailFor(isMobile), DEMO_EMAIL],
    );
  });
});

// Deleting the user removes its saves too, so other specs are unaffected.
test.afterEach(async ({ isMobile }) => {
  await withDb((client) => client.query(`DELETE FROM users WHERE email = $1`, [emailFor(isMobile)]));
});

// Each test gets its own client address so the sign-in rate limit cannot couple tests.
async function ownAddress(page: Page) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
}

async function signIn(page: Page, isMobile: boolean) {
  await page.getByLabel("Email").fill(emailFor(isMobile));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("a student saves from the reader, finds it under Saved, removes it and sees the empty state", async ({ page, isMobile }) => {
  await ownAddress(page);
  const id = await resourceId("DEMO301", "Sample notes");
  await page.goto("/sign-in?next=" + encodeURIComponent(`/resources/${id}`));
  await signIn(page, isMobile);
  await expect(page).toHaveURL(new RegExp(`/resources/${id}$`));

  const details = page.getByRole("complementary", { name: "About this file" });
  await details.getByRole("button", { name: "Save for later" }).click();
  await expect(page.getByText("Saved. Find it under Saved in your account menu.")).toBeVisible();

  await page.getByRole("button", { name: "Saved Tester" }).click();
  await page.getByRole("menuitem", { name: "Saved" }).click();
  await expect(page).toHaveURL("/saved");
  await expect(page.getByRole("heading", { level: 1, name: "Saved" })).toBeVisible();

  const course = page.getByRole("region", { name: /DEMO301/ });
  await expect(course.getByRole("link", { name: /Sample notes/ })).toHaveAttribute("href", `/resources/${id}`);
  const remove = course.getByRole("button", { name: "Remove Sample notes from saved" });
  await expect(remove).toHaveAttribute("aria-pressed", "true");

  // The row's link and the bookmark are separate controls.
  expect(await course.locator("a button, button a").count()).toBe(0);

  await remove.click();
  await expect(page.getByText("Removed from saved.")).toBeVisible();
  await expect(page.getByText("Nothing saved yet. Tap the bookmark on any file to keep it here.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse courses" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Sample notes/ })).toHaveCount(0);
  await expect(page).toHaveURL("/saved");

  await page.reload();
  await expect(page.getByText("Nothing saved yet. Tap the bookmark on any file to keep it here.")).toBeVisible();
  expect(
    await withDb(async (client) => (await client.query(`SELECT count(*)::int AS n FROM bookmarks WHERE resource_id = $1`, [id])).rows[0].n),
  ).toBe(0);
});

test("courses are listed by semester and code, not by the order of saving", async ({ page, isMobile, baseURL }) => {
  await ownAddress(page);
  await page.goto("/sign-in?next=%2Fsaved");
  await signIn(page, isMobile);
  await expect(page).toHaveURL("/saved");
  await expect(page.getByText("Nothing saved yet.")).toBeVisible();

  const origin = new URL(baseURL!).origin;
  // Saved later, listed first: DEMO301 (semester 3) before DEMO501 (semester 5).
  for (const code of ["DEMO501", "DEMO301"]) {
    const response = await page.request.put(`/api/v1/saved/${await resourceId(code, "Sample notes")}`, { headers: { origin } });
    expect(response.status()).toBe(204);
  }
  await page.reload();
  const headings = page.getByRole("main").getByRole("heading", { level: 2 });
  await expect(headings).toHaveCount(2);
  await expect(headings.nth(0)).toContainText("DEMO301");
  await expect(headings.nth(0)).toContainText("Semester 3");
  await expect(headings.nth(1)).toContainText("DEMO501");
});

test("a signed-out visitor is sent to sign-in and returns to Saved after signing in", async ({ page, isMobile }) => {
  await ownAddress(page);
  await page.goto("/saved");
  await expect(page).toHaveURL("/sign-in?next=%2Fsaved");
  await signIn(page, isMobile);
  await expect(page).toHaveURL("/saved");
  await expect(page.getByRole("heading", { level: 1, name: "Saved" })).toBeVisible();
});

test("the phone bottom tab bar has no Saved item", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The bottom tab bar is a phone layout");
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Browse" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Saved" })).toHaveCount(0);
});

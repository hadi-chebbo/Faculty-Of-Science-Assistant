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

const STUDENT_EMAIL = "demo.student@example.com"; // from the demo seed
const STUDENT_PASSWORD = "demo-student-password";

// Desktop and phone run at the same time and share the demo student, so each marks a file of its
// own. DEMO501's chapters 1 and 2 hold one lecture each and no other spec marks them: spec files
// run in parallel too, so no exact course-wide percentage is asserted.
test.describe.configure({ mode: "serial" });
const fileFor = (isMobile: boolean) =>
  isMobile
    ? { course: "DEMO501", title: "Sample lecture 2", chapter: 2 }
    : { course: "DEMO501", title: "Sample lecture 1", chapter: 1 };

async function withDb<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

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

test.afterEach(async ({ isMobile }) => {
  const { course, title } = fileFor(isMobile);
  const id = await resourceId(course, title);
  await withDb((client) => client.query(`DELETE FROM completions WHERE resource_id = $1`, [id]));
});

async function ownAddress(page: Page) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
}

async function signInTo(page: Page, next: string) {
  await ownAddress(page);
  await page.goto("/sign-in?next=" + encodeURIComponent(next));
  await page.getByLabel("Email").fill(STUDENT_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(STUDENT_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(next);
}

test("marking the last file of a chapter makes its card say Finished, and the header shows the progress", async ({ page, isMobile }) => {
  const { course, title, chapter } = fileFor(isMobile);
  const id = await resourceId(course, title);
  await signInTo(page, `/courses/${course}`);

  const card = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: new RegExp(`Chapter ${chapter}`) }) });
  await expect(card).toContainText("Not started · 1 file");
  await expect(card).not.toContainText("Finished");

  await page.goto(`/resources/${id}`);
  await page.getByRole("complementary", { name: "About this file" }).getByRole("button", { name: "Mark as done" }).click();
  await expect(page.getByRole("complementary", { name: "About this file" }).getByRole("button", { name: "Done", exact: true })).toBeVisible();

  await page.goto(`/courses/${course}`);
  await expect(card).toContainText("Finished");
  await expect(page.getByRole("link", { name: /^Your progress: \d+% done, \d+ of \d+ files\./ })).toBeVisible();
  if (!isMobile) {
    const block = page.getByRole("link", { name: /^Your progress:/ });
    await expect(block).toContainText("Your progress");
    await expect(block).toContainText(/\d+ of \d+ files done/);
  }
});

test("a visitor sees no progress block, no chapter progress and makes no progress request", async ({ page, isMobile }) => {
  const asked: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/progress/")) asked.push(request.url());
  });
  const { course, chapter } = fileFor(isMobile);
  await page.goto(`/courses/${course}`);
  const card = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: new RegExp(`Chapter ${chapter}`) }) });
  await expect(card).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("link", { name: /^Your progress/ })).toHaveCount(0);
  await expect(card).not.toContainText(/Finished|Not started|\d+ of \d+ done/);
  expect(asked).toEqual([]);
});

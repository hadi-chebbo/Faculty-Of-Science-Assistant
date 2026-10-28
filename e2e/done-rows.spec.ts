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
// own. They are not the files e2e/mark-done-reader.spec.ts marks: spec files run in parallel too.
test.describe.configure({ mode: "serial" });
const fileFor = (isMobile: boolean) =>
  isMobile
    ? { course: "DEMO302", title: "Sample lecture 1", list: "/courses/DEMO302/chapters/1" }
    : { course: "DEMO301", title: "Sample lecture 2", list: "/courses/DEMO301/chapters/2" };

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

test("a signed-in student marks a file in the reader and its row shows Done, other rows Not done", async ({ page, isMobile }) => {
  const { course, title, list } = fileFor(isMobile);
  const id = await resourceId(course, title);
  await signInTo(page, `/resources/${id}`);

  await page.getByRole("complementary", { name: "About this file" }).getByRole("button", { name: "Mark as done" }).click();
  await expect(page.getByRole("complementary", { name: "About this file" }).getByRole("button", { name: "Done", exact: true })).toBeVisible();

  await page.goto(list);
  const row = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: new RegExp(title) }) });
  await expect(row.getByRole("img", { name: "Done" })).toBeVisible();
  await expect(row.getByRole("img", { name: "Not done" })).toHaveCount(0);

  // An exam that is not done shows an empty circle.
  await page.goto("/exams");
  const exam = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: /Sample partial exam 2023/ }) }).first();
  await expect(exam.getByRole("img", { name: "Not done" })).toBeVisible();
});

test("a row of an other file has neither a check nor a circle", async ({ page }) => {
  await signInTo(page, "/exams");
  // Signed in, rows of other files get an empty spacer, not a circle (solutions work the same way).
  await page.goto("/search?q=reference+sheet");
  const row = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: /Sample reference sheet/ }) }).first();
  await expect(row).toBeVisible();
  await expect(row.getByRole("img", { name: /^(Done|Not done)$/ })).toHaveCount(0);
});

test("a visitor sees no status cells and the page never asks for completed ids", async ({ page, isMobile }) => {
  const asked: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/completions/ids")) asked.push(request.url());
  });
  const { title, list } = fileFor(isMobile);
  await page.goto(list);
  await expect(page.getByRole("link", { name: new RegExp(title) }).first()).toBeVisible();
  // Give the browser store time to ask who is signed in.
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("img", { name: /^(Done|Not done)$/ })).toHaveCount(0);
  expect(asked).toEqual([]);
});

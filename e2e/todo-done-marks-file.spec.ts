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

// The two projects (desktop, phone) run at the same time, each as its own fresh student with an
// empty board and a lecture of its own (a General file in DEMO302, sharing the stored file of that
// course's first lecture), so no other spec's files or the demo student's completions are touched.
// The tests of one project run one after the other.
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

const suffix = (isMobile: boolean) => (isMobile ? "phone" : "desktop");
const emailFor = (isMobile: boolean) => `todo-done-marks-${suffix(isMobile)}@example.com`;
const titleFor = (isMobile: boolean) => `E2E done-marks file ${suffix(isMobile)}`;

async function fileId(isMobile: boolean): Promise<string> {
  return withDb(async (client) => {
    const { rows } = await client.query(`SELECT id FROM resources WHERE title = $1`, [titleFor(isMobile)]);
    expect(rows).toHaveLength(1);
    return rows[0].id;
  });
}

test.beforeEach(async ({ isMobile }) => {
  await withDb(async (client) => {
    await client.query(`DELETE FROM resources WHERE title = $1`, [titleFor(isMobile)]);
    await client.query(`DELETE FROM users WHERE email = $1`, [emailFor(isMobile)]);
    await client.query(
      `INSERT INTO users (email, name, password_hash, role, email_confirmed_at, created_at, updated_at)
       SELECT $1, 'Done Tester', password_hash, 'student', now(), now(), now() FROM users WHERE email = $2`,
      [emailFor(isMobile), DEMO_EMAIL],
    );
    // The first-file milestone is already earned, so its toast does not stack over the Undo toast.
    await client.query(`INSERT INTO milestones (user_id, key) SELECT id, 'first_file' FROM users WHERE email = $1`, [emailFor(isMobile)]);
    await client.query(
      `INSERT INTO resources (course_id, type, title, language, file_key, is_published)
       SELECT r.course_id, 'lecture', $1, 'en', r.file_key, true
       FROM resources r JOIN courses c ON c.id = r.course_id
       WHERE c.code = 'DEMO302' AND r.title = 'Sample lecture 1'`,
      [titleFor(isMobile)],
    );
  });
});

// Deleting the user removes its cards and completions; deleting the file removes the rest.
test.afterEach(async ({ isMobile }) => {
  await withDb(async (client) => {
    await client.query(`DELETE FROM users WHERE email = $1`, [emailFor(isMobile)]);
    await client.query(`DELETE FROM resources WHERE title = $1`, [titleFor(isMobile)]);
  });
});

const doneCount = (id: string, isMobile: boolean) =>
  withDb(
    async (client) =>
      (
        await client.query(
          `SELECT count(*)::int AS n FROM completions c JOIN users u ON u.id = c.user_id WHERE c.resource_id = $1 AND u.email = $2`,
          [id, emailFor(isMobile)],
        )
      ).rows[0].n as number,
  );

async function signInTo(page: Page, isMobile: boolean, next: string) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  await page.goto("/sign-in?next=" + encodeURIComponent(next));
  await page.getByLabel("Email").fill(emailFor(isMobile));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(next);
}

const MESSAGE = "Nice, that's done. File marked as done too.";
const card = (page: Page, title: string) => page.locator("article:visible", { has: page.getByRole("heading", { level: 3, name: title }) });
const toastWith = (page: Page, message: string) => page.locator("[data-sonner-toast]", { hasText: message });
const details = (page: Page) => page.getByRole("complementary", { name: "About this file" });

// Adds the file to the board from the reader, then moves its card to Done from the card's menu.
async function addAndMoveToDone(page: Page, isMobile: boolean, id: string) {
  await signInTo(page, isMobile, `/resources/${id}`);
  await details(page).getByRole("button", { name: "Add to to-do" }).click();
  await expect(toastWith(page, "Added to To do")).toBeVisible();
  await page.goto("/todo");
  const title = titleFor(isMobile);
  await expect(card(page, title)).toBeVisible();
  await expect(card(page, title)).not.toContainText("File done");
  await card(page, title).getByRole("button", { name: `Actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Done", exact: true }).click();
}

test("moving a card with a file to Done marks the file: toast, tile and the reader agree", async ({ page, isMobile }) => {
  const id = await fileId(isMobile);
  await addAndMoveToDone(page, isMobile, id);

  await expect(toastWith(page, MESSAGE)).toBeVisible();
  if (isMobile) await page.getByRole("tab", { name: /^Done/ }).click();
  await expect(card(page, titleFor(isMobile)).getByText("File done")).toBeVisible();
  expect(await doneCount(id, isMobile)).toBe(1);

  // A reload shows it too, and the reader (opened from the tile) has the file done.
  await page.reload();
  if (isMobile) await page.getByRole("tab", { name: /^Done/ }).click();
  await expect(card(page, titleFor(isMobile)).getByText("File done")).toBeVisible();
  await card(page, titleFor(isMobile)).getByRole("link", { name: /^Open/ }).click();
  await expect(page).toHaveURL(`/resources/${id}`);
  await expect(details(page).getByRole("button", { name: "Done", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("the reader opened by in-app navigation right after the move already shows Done", async ({ page, isMobile }) => {
  const id = await fileId(isMobile);
  await addAndMoveToDone(page, isMobile, id);
  await expect(toastWith(page, MESSAGE)).toBeVisible();
  if (isMobile) await page.getByRole("tab", { name: /^Done/ }).click();
  await card(page, titleFor(isMobile)).getByRole("link", { name: /^Open/ }).click();
  await expect(page).toHaveURL(`/resources/${id}`);
  await expect(details(page).getByRole("button", { name: "Done", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("Undo moves the card back and un-marks the file", async ({ page, isMobile }) => {
  const id = await fileId(isMobile);
  await addAndMoveToDone(page, isMobile, id);

  await expect(toastWith(page, MESSAGE)).toBeVisible();
  await expect.poll(() => doneCount(id, isMobile)).toBe(1);
  await toastWith(page, MESSAGE).getByRole("button", { name: "Undo" }).click();

  await expect.poll(() => doneCount(id, isMobile)).toBe(0);
  if (isMobile) await page.getByRole("tab", { name: /^To do/ }).click();
  await expect(card(page, titleFor(isMobile))).toBeVisible();
  await expect(card(page, titleFor(isMobile))).not.toContainText("File done");

  await page.goto(`/resources/${id}`);
  await expect(details(page).getByRole("button", { name: "Mark as done" })).toHaveAttribute("aria-pressed", "false");
});

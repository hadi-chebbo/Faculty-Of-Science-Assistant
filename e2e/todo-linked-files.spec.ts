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
// empty board; the tests of one project run one after the other.
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

const emailFor = (isMobile: boolean) => `todo-files-${isMobile ? "phone" : "desktop"}@example.com`;

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
       SELECT $1, 'Files Tester', password_hash, 'student', now(), now(), now() FROM users WHERE email = $2`,
      [emailFor(isMobile), DEMO_EMAIL],
    );
  });
});

// Deleting the user removes its saves and cards too, so other specs are unaffected.
test.afterEach(async ({ isMobile }) => {
  await withDb((client) => client.query(`DELETE FROM users WHERE email = $1`, [emailFor(isMobile)]));
});

async function signInTo(page: Page, isMobile: boolean, next: string) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  await page.goto("/sign-in?next=" + encodeURIComponent(next));
  await page.getByLabel("Email").fill(emailFor(isMobile));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(next);
}

const topCard = (page: Page) => page.locator("article:visible").first();
const cardCount = (isMobile: boolean) =>
  withDb(
    async (client) =>
      (await client.query(`SELECT count(*)::int AS n FROM todos t JOIN users u ON u.id = t.user_id WHERE u.email = $1`, [emailFor(isMobile)]))
        .rows[0].n as number,
  );

test("add a saved file to the to-do from /saved, see the card at the top of To do and open the file from it", async ({ page, isMobile }) => {
  const id = await resourceId("DEMO301", "Sample notes");
  await withDb((client) =>
    client.query(`INSERT INTO bookmarks (user_id, resource_id) SELECT id, $2 FROM users WHERE email = $1`, [emailFor(isMobile), id]),
  );
  await signInTo(page, isMobile, "/saved");

  await page.getByRole("button", { name: "Add Sample notes to to-do" }).click();
  const toast = page.locator("[data-sonner-toast]", { hasText: "Added to To do" });
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "View board" }).click();
  await expect(page).toHaveURL("/todo");

  const card = topCard(page);
  await expect(card.getByRole("heading", { level: 3 })).toHaveText("Sample notes");
  await expect(card).toContainText("DEMO301");
  await expect(card).toContainText("Notes");
  await card.getByRole("link", { name: /^Open/ }).click();
  await expect(page).toHaveURL(`/resources/${id}`);
  expect(await cardCount(isMobile)).toBe(1);
});

test("add to to-do from the reader's details column, and again from More actions", async ({ page, isMobile }) => {
  const id = await resourceId("DEMO301", "Sample notes");
  await signInTo(page, isMobile, `/resources/${id}`);

  const details = page.getByRole("complementary", { name: "About this file" });
  await details.getByRole("button", { name: "Add to to-do" }).click();
  await expect(page.locator("[data-sonner-toast]", { hasText: "Added to To do" })).toBeVisible();
  await expect.poll(() => cardCount(isMobile)).toBe(1);

  // The same file may be added again, from the menu this time.
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole(isMobile ? "button" : "menuitem", { name: "Add to to-do" }).click();
  await expect.poll(() => cardCount(isMobile)).toBe(2);

  await page.goto("/todo");
  await expect(topCard(page).getByRole("heading", { level: 3 })).toHaveText("Sample notes");
});

test("signed out, Add to to-do goes to sign-in and back", async ({ page }) => {
  const id = await resourceId("DEMO301", "Sample notes");
  await page.goto(`/resources/${id}`);
  await page.getByRole("complementary", { name: "About this file" }).getByRole("button", { name: "Add to to-do" }).click();
  await expect(page).toHaveURL(`/sign-in?next=${encodeURIComponent(`/resources/${id}`)}`);
});

import { randomBytes } from "node:crypto";
import { expect, test, type Page, type Response } from "@playwright/test";
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

const emailFor = (isMobile: boolean) => `todo-picker-${isMobile ? "phone" : "desktop"}@example.com`;

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
       SELECT $1, 'Picker Tester', password_hash, 'student', now(), now(), now() FROM users WHERE email = $2`,
      [emailFor(isMobile), DEMO_EMAIL],
    );
  });
});

// Deleting the user removes its saves and cards too, so other specs are unaffected.
test.afterEach(async ({ isMobile }) => {
  await withDb((client) => client.query(`DELETE FROM users WHERE email = $1`, [emailFor(isMobile)]));
});

const topCard = (page: Page) => page.locator("article:visible").first();
const dialog = (page: Page) => page.getByRole("dialog");
const isPatch = (r: Response) => /\/api\/v1\/todos\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH";

async function saveFile(isMobile: boolean, id: string) {
  await withDb((client) =>
    client.query(`INSERT INTO bookmarks (user_id, resource_id) SELECT id, $2 FROM users WHERE email = $1`, [emailFor(isMobile), id]),
  );
}

async function seedCard(isMobile: boolean, card: { title: string; note?: string; resourceId?: string }) {
  await withDb((client) =>
    client.query(
      `INSERT INTO todos (user_id, status, position, title, note, resource_id)
       SELECT id, 'todo', 0, $2, $3, $4 FROM users WHERE email = $1`,
      [emailFor(isMobile), card.title, card.note ?? "", card.resourceId ?? null],
    ),
  );
}

async function signInOnBoard(page: Page, isMobile: boolean) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  await page.goto("/sign-in?next=%2Ftodo");
  await page.getByLabel("Email").fill(emailFor(isMobile));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/todo");
  await expect(page.getByRole("heading", { level: 1, name: "To-do" })).toBeVisible();
}

test("link a saved file to a note card from the picker, keep it after a reload, then remove it", async ({ page, isMobile }) => {
  await saveFile(isMobile, await resourceId("DEMO301", "Sample notes"));
  await seedCard(isMobile, { title: "Revise chapter 1", note: "proofs" });
  await signInOnBoard(page, isMobile);

  await page.getByRole("button", { name: "Revise chapter 1", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Link one of your saved files" }).click();
  await expect(dialog(page).getByText("DEMO301", { exact: false }).first()).toBeVisible();
  const linked = page.waitForResponse(isPatch);
  await dialog(page).getByRole("button", { name: "Sample notes" }).click();
  expect((await linked).status()).toBe(200);
  await expect(dialog(page).getByRole("link", { name: /^Open/ })).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Remove" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(topCard(page)).toContainText("DEMO301");

  await page.reload();
  await expect(topCard(page)).toContainText("DEMO301");
  await page.getByRole("button", { name: "Revise chapter 1", exact: true }).click();
  await expect(dialog(page).getByRole("link", { name: /^Open/ })).toBeVisible();

  const removed = page.waitForResponse(isPatch);
  await dialog(page).getByRole("button", { name: "Remove" }).click();
  expect((await removed).status()).toBe(200);
  await expect(dialog(page).getByRole("button", { name: "Link one of your saved files" })).toBeFocused();
  await page.reload();
  await expect(page.getByRole("button", { name: "Revise chapter 1", exact: true })).toBeVisible();
  await expect(topCard(page)).not.toContainText("DEMO301");
  await page.getByRole("button", { name: "Revise chapter 1", exact: true }).click();
  await expect(dialog(page).getByRole("button", { name: "Link one of your saved files" })).toBeVisible();
});

test("removing the file of a card with no title of its own keeps the file's title as the card's title", async ({ page, isMobile }) => {
  const id = await resourceId("DEMO301", "Sample notes");
  await seedCard(isMobile, { title: "", note: "see page 3", resourceId: id });
  await signInOnBoard(page, isMobile);

  await page.getByRole("button", { name: "Sample notes", exact: true }).click();
  const removed = page.waitForResponse(isPatch);
  await dialog(page).getByRole("button", { name: "Remove" }).click();
  expect((await removed).status()).toBe(200);
  await page.reload();
  await expect(topCard(page).getByRole("heading", { level: 3 })).toHaveText("Sample notes");
  await expect(topCard(page)).not.toContainText("DEMO301");
  await page.getByRole("button", { name: "Sample notes", exact: true }).click();
  await expect(dialog(page).getByRole("textbox", { name: "Title" })).toHaveValue("Sample notes");
});

test("the composer links a saved file; with an empty title the card takes the file's title and Open works", async ({ page, isMobile }) => {
  const id = await resourceId("DEMO301", "Sample notes");
  await saveFile(isMobile, id);
  await signInOnBoard(page, isMobile);

  await page.getByRole("button", { name: "New card", exact: true }).click();
  const input = page.getByRole("textbox", { name: "New card in To do" });
  await page.getByRole("button", { name: "Link a saved file" }).click();
  await page.getByRole("button", { name: "Sample notes" }).click();
  await expect(page.getByRole("button", { name: "Remove Sample notes" })).toBeVisible();
  await expect(input).toHaveAttribute("placeholder", "Sample notes");

  await page.getByRole("button", { name: "Add card" }).click();
  await expect(topCard(page).getByRole("heading", { level: 3 })).toHaveText("Sample notes");
  await expect(topCard(page)).toContainText("DEMO301");
  // The form stays open and is clear again.
  await expect(input).toHaveValue("");
  await expect(page.getByRole("button", { name: "Link a saved file" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Sample notes" })).toHaveCount(0);

  await expect.poll(async () => withDb(async (c) => (await c.query(`SELECT count(*)::int AS n FROM todos WHERE resource_id = $1`, [id])).rows[0].n)).toBe(1);
  await topCard(page).getByRole("link", { name: /^Open/ }).click();
  await expect(page).toHaveURL(`/resources/${id}`);
});

test("Esc closes only the picker, in the composer", async ({ page, isMobile }) => {
  await saveFile(isMobile, await resourceId("DEMO301", "Sample notes"));
  await signInOnBoard(page, isMobile);
  await page.getByRole("button", { name: "New card", exact: true }).click();
  await page.getByRole("button", { name: "Link a saved file" }).click();
  await expect(page.getByRole("button", { name: "Sample notes" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Sample notes" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "New card in To do" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Link a saved file" })).toBeFocused();
});

test("the picker says so when nothing is saved", async ({ page, isMobile }) => {
  await seedCard(isMobile, { title: "A card" });
  await signInOnBoard(page, isMobile);
  await page.getByRole("button", { name: "A card", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Link one of your saved files" }).click();
  await expect(dialog(page).getByText("Nothing saved yet. Tap the bookmark on any file to save it, then link it here.")).toBeVisible();
  // Esc closes the picker but not the card view.
  await page.keyboard.press("Escape");
  await expect(dialog(page).getByText("Nothing saved yet.")).toHaveCount(0);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Link one of your saved files" })).toBeFocused();
});

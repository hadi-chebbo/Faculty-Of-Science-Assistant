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

// The two projects (desktop, phone) run at the same time and share the one demo student, so each
// saves a different file; the tests of one project run one after the other.
test.describe.configure({ mode: "serial" });
const courseFor = (isMobile: boolean) => (isMobile ? "DEMO401" : "DEMO301");

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

const savedCount = (id: string) =>
  withDb(async (client) => (await client.query(`SELECT count(*)::int AS n FROM bookmarks WHERE resource_id = $1`, [id])).rows[0].n);

// Leaves no saves behind, so other specs are unaffected.
test.afterEach(async ({ isMobile }) => {
  const id = await resourceId(courseFor(isMobile), "Sample lecture 1");
  await withDb((client) => client.query(`DELETE FROM bookmarks WHERE resource_id = $1`, [id]));
});

// Each test gets its own client address so the sign-in rate limit cannot couple tests.
async function ownAddress(page: Page) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
}

async function signIn(page: Page) {
  await page.getByLabel("Email").fill(STUDENT_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(STUDENT_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const details = (page: Page) => page.getByRole("complementary", { name: "About this file" });
const openMenu = (page: Page) => page.getByRole("button", { name: "More actions" }).click();
const menuEntry = (page: Page, isMobile: boolean, name: string) => page.getByRole(isMobile ? "button" : "menuitem", { name });

test("a signed-in student saves from the reader, still sees it saved after a reload, and removes it from the menu", async ({
  page,
  isMobile,
}) => {
  await ownAddress(page);
  const id = await resourceId(courseFor(isMobile), "Sample lecture 1");
  await page.goto("/sign-in?next=" + encodeURIComponent(`/resources/${id}`));
  await signIn(page);
  await expect(page).toHaveURL(new RegExp(`/resources/${id}$`));

  const save = details(page).getByRole("button", { name: "Save for later" });
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await save.click();
  await expect(page.getByText("Saved. Find it under Saved in your account menu.")).toBeVisible();
  await expect(details(page).getByRole("button", { name: "Saved", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await savedCount(id)).toBe(1);

  await page.reload();
  await expect(details(page).getByRole("button", { name: "Saved", exact: true })).toBeVisible();

  // The menu agrees (on a phone it is a sheet), and removing there updates the button too.
  await openMenu(page);
  await expect(menuEntry(page, isMobile, "Save for later")).toHaveCount(0);
  await menuEntry(page, isMobile, "Remove from saved").click();
  await expect(page.getByText("Removed from saved.")).toBeVisible();
  await expect(details(page).getByRole("button", { name: "Save for later" })).toHaveAttribute("aria-pressed", "false");
  expect(await savedCount(id)).toBe(0);

  await page.reload();
  await expect(details(page).getByRole("button", { name: "Save for later" })).toBeVisible();
  await openMenu(page);
  await expect(menuEntry(page, isMobile, "Save for later")).toBeVisible();
  expect(await savedCount(id)).toBe(0);
});

test("the More actions menu offers Save for later first in its download group, on desktop and on a phone", async ({ page, isMobile }) => {
  await page.goto(`/resources/${await resourceId(courseFor(isMobile), "Sample lecture 1")}`);
  await openMenu(page);
  await expect(menuEntry(page, isMobile, "Save for later")).toBeVisible();
  await expect(page.getByRole(isMobile ? "link" : "menuitem", { name: "Download" })).toBeVisible();
});

test("a signed-out visitor goes to sign-in and back to the same reader page, and nothing is saved", async ({ page, isMobile }) => {
  await ownAddress(page);
  const id = await resourceId(courseFor(isMobile), "Sample lecture 1");
  await page.goto(`/resources/${id}`);
  // The state was asked for and the answer was "signed out"; the button looks the same.
  await expect(details(page).getByRole("button", { name: "Save for later" })).toBeVisible();
  await details(page).getByRole("button", { name: "Save for later" }).click();
  await expect(page).toHaveURL(`/sign-in?next=${encodeURIComponent(`/resources/${id}`)}`);

  await signIn(page);
  await expect(page).toHaveURL(new RegExp(`/resources/${id}$`));
  await expect(details(page).getByRole("button", { name: "Save for later" })).toHaveAttribute("aria-pressed", "false");
  expect(await savedCount(id)).toBe(0);
});

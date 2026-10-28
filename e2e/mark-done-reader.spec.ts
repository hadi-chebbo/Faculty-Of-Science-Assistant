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
// marks a file of its own course; the tests of one project run one after the other. DEMO301's
// "Sample lecture 1" is alone in chapter 1; DEMO401 has no chapters.
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

const doneCount = (id: string) =>
  withDb(async (client) => (await client.query(`SELECT count(*)::int AS n FROM completions WHERE resource_id = $1`, [id])).rows[0].n);

// Leaves no completions behind, so other specs are unaffected.
test.afterEach(async ({ isMobile }) => {
  const id = await resourceId(courseFor(isMobile), "Sample lecture 1");
  await withDb((client) => client.query(`DELETE FROM completions WHERE resource_id = $1`, [id]));
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

async function openSignedIn(page: Page, id: string) {
  await ownAddress(page);
  await page.goto("/sign-in?next=" + encodeURIComponent(`/resources/${id}`));
  await signIn(page);
  await expect(page).toHaveURL(new RegExp(`/resources/${id}$`));
}

const details = (page: Page) => page.getByRole("complementary", { name: "About this file" });
const markButton = (page: Page) => details(page).getByRole("button", { name: "Mark as done" });
const doneButton = (page: Page) => details(page).getByRole("button", { name: "Done", exact: true });
const openMenu = (page: Page) => page.getByRole("button", { name: "More actions" }).click();
const menuEntry = (page: Page, isMobile: boolean, name: string) => page.getByRole(isMobile ? "button" : "menuitem", { name, exact: true });
const undoIn = (page: Page, message: string) =>
  page.locator("[data-sonner-toast]", { hasText: message }).getByRole("button", { name: "Undo" });

test("a student marks a file as done, still sees it done after a reload, and un-marks it with Undo in between", async ({
  page,
  isMobile,
}) => {
  const id = await resourceId(courseFor(isMobile), "Sample lecture 1");
  await openSignedIn(page, id);

  // Opening the file counts for nothing.
  await expect(markButton(page)).toHaveAttribute("aria-pressed", "false");
  expect(await doneCount(id)).toBe(0);

  await markButton(page).click();
  const marked = isMobile ? "Marked as done." : "Marked as done. Chapter 1: 1 of 1.";
  await expect(page.locator("[data-sonner-toast]", { hasText: marked })).toBeVisible();
  await expect(doneButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(details(page).getByText(isMobile ? /DEMO401: 1 of 2 files done/ : /Chapter 1: 1 of 1 files done/)).toBeVisible();
  expect(await doneCount(id)).toBe(1);

  await page.reload();
  await expect(doneButton(page)).toBeVisible();

  // Un-mark, then Undo puts the mark back.
  await doneButton(page).click();
  await expect(markButton(page)).toHaveAttribute("aria-pressed", "false");
  await undoIn(page, "Marked as not done.").click();
  await expect(doneButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => doneCount(id)).toBe(1);

  // The menu agrees, and un-marking there updates the button too.
  await openMenu(page);
  await menuEntry(page, isMobile, "Mark as not done").click();
  await expect(markButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => doneCount(id)).toBe(0);
});

test("Undo right after marking takes the mark back", async ({ page, isMobile }) => {
  const id = await resourceId(courseFor(isMobile), "Sample lecture 1");
  await openSignedIn(page, id);
  await markButton(page).click();
  await undoIn(page, "Marked as done").click();
  await expect(markButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => doneCount(id)).toBe(0);
  await page.reload();
  await expect(markButton(page)).toBeVisible();
});

test("a signed-out visitor goes to sign-in and back to the same reader page, and nothing is marked", async ({ page, isMobile }) => {
  await ownAddress(page);
  const id = await resourceId(courseFor(isMobile), "Sample lecture 1");
  await page.goto(`/resources/${id}`);
  await markButton(page).click();
  await expect(page).toHaveURL(`/sign-in?next=${encodeURIComponent(`/resources/${id}`)}`);

  await signIn(page);
  await expect(page).toHaveURL(new RegExp(`/resources/${id}$`));
  await expect(markButton(page)).toHaveAttribute("aria-pressed", "false");
  expect(await doneCount(id)).toBe(0);
});

test("a solution cannot be marked: no button and no menu entry", async ({ page, isMobile }) => {
  await page.goto(`/resources/${await resourceId("DEMO301", "Sample partial exam 2023 solution")}`);
  await expect(details(page).getByRole("button", { name: "Save for later" })).toBeVisible();
  await expect(markButton(page)).toHaveCount(0);
  await openMenu(page);
  await expect(menuEntry(page, isMobile, "Save for later")).toBeVisible();
  await expect(menuEntry(page, isMobile, "Mark as done")).toHaveCount(0);
});

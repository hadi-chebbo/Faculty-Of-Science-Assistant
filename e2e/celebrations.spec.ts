import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

// Needs the demo data (SEED_DEMO_DATA=true npm run db:seed, STORAGE_DRIVER=local). Each test of each
// project (desktop, phone) uses a fresh confirmed student of its own, created and deleted here, so
// what it finishes touches no other spec.
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

async function resourceId(code: string, title: string): Promise<string> {
  return withDb(async (client) => {
    const { rows } = await client.query(
      `SELECT r.id FROM resources r JOIN courses c ON c.id = r.course_id WHERE c.code = $1 AND r.title = $2 AND r.is_published`,
      [code, title],
    );
    expect(rows).toHaveLength(1);
    return rows[0].id as string;
  });
}

async function createStudent(page: Page, email: string): Promise<void> {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  await withDb(async (client) => {
    await client.query(`DELETE FROM users WHERE email = $1`, [email]);
    await client.query(
      `INSERT INTO users (email, name, password_hash, role, email_confirmed_at, created_at, updated_at)
       SELECT $1, 'Celebrations', password_hash, 'student', now(), now(), now() FROM users WHERE email = $2`,
      [email, DEMO_EMAIL],
    );
  });
}

async function signInAt(page: Page, email: string, next: string): Promise<void> {
  await page.goto("/sign-in?next=" + encodeURIComponent(next));
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(next);
}

async function markDone(page: Page): Promise<void> {
  const saved = page.waitForResponse((r) => r.url().includes("/api/v1/completions/") && r.request().method() === "PUT" && r.ok());
  await page.getByRole("complementary", { name: "About this file" }).getByRole("button", { name: "Mark as done" }).click();
  await saved;
}

// Marks the first file, then goes to the second and marks it too.
async function finishCourse(page: Page, email: string, code: string, first: string, second: string) {
  await createStudent(page, email);
  const firstPath = `/resources/${await resourceId(code, first)}`;
  const secondPath = `/resources/${await resourceId(code, second)}`;
  await signInAt(page, email, firstPath);
  await markDone(page);
  await page.goto(secondPath);
  await markDone(page);
  return page.getByRole("dialog", { name: `${code} finished` });
}

const tag = (isMobile: boolean) => (isMobile ? "phone" : "desktop");

test("finishing a chapter shows one toast with Undo and Next chapter", async ({ page, isMobile }) => {
  const email = `cel-chapter-${tag(isMobile)}@example.com`;
  await createStudent(page, email);
  try {
    const path = `/resources/${await resourceId("DEMO501", "Sample lecture 1")}`;
    await signInAt(page, email, path);
    await markDone(page);
    const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Chapter 1 finished!" });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("Sample chapter 1, all 1 files done.");
    await expect(toast.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Marked as done" })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await toast.getByRole("button", { name: /Next chapter/ }).click();
    await expect(page).toHaveURL(/\/courses\/DEMO501\/chapters\/2$/);
  } finally {
    await withDb((client) => client.query(`DELETE FROM users WHERE email = $1`, [email]));
  }
});

test("finishing a course opens the dialog, Esc closes it and focus returns to Done", async ({ page, isMobile }) => {
  const email = `cel-course-${tag(isMobile)}@example.com`;
  try {
    const dialog = await finishCourse(page, email, "DEMO402", "Sample lecture 1", "Sample exercise sheet 1");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("You marked all 2 files of Sample Course D as done. Exams: 0 of 1 done.");
    await expect(dialog.getByRole("link", { name: "See your progress" })).toHaveAttribute("href", "/progress");
    await expect(dialog.locator(":focus")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("complementary", { name: "About this file" }).getByRole("button", { name: "Done" })).toBeFocused();
  } finally {
    await withDb((client) => client.query(`DELETE FROM users WHERE email = $1`, [email]));
  }
});

test("with reduced motion the dialog still shows and no confetti is visible", async ({ page, isMobile }) => {
  const email = `cel-reduced-${tag(isMobile)}@example.com`;
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    const dialog = await finishCourse(page, email, "DEMO502", "Sample lecture 1", "Sample exercise sheet 1");
    await expect(dialog).toBeVisible();
    await expect(page.locator(".confetti")).toBeHidden();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  } finally {
    await withDb((client) => client.query(`DELETE FROM users WHERE email = $1`, [email]));
  }
});

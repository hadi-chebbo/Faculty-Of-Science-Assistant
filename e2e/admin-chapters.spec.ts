import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// Needs the demo data and an admin. The writing tests all use DEMO402: it has no chapters and no
// other spec opens its course page (a course that gains a chapter switches its public layout).
// Every writing test removes what it created in a `finally` block. They share one course and
// depend on positions, so they run serially and only in the desktop project. The read-only tests
// run in both projects.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: CI passes the variables in the environment.
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const PREFIX = "E2E page chapter";

test.beforeAll(() => {
  expect(ADMIN_EMAIL && ADMIN_PASSWORD, "ADMIN_EMAIL and ADMIN_PASSWORD must be set").toBeTruthy();
});

// Test-only database access: cleanup must work even when the page under test failed.
async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

const demoCourseId = async () => (await query<{ id: string }>("SELECT id FROM courses WHERE code = 'DEMO402'"))[0].id;
// Resources first: deleting a chapter only unsets their chapter, and the item is ours anyway.
async function cleanUp(courseId: string) {
  await query("DELETE FROM resources WHERE course_id = $1 AND title LIKE $2", [courseId, `${PREFIX} item%`]);
  await query("DELETE FROM chapters WHERE course_id = $1 AND title LIKE $2", [courseId, `${PREFIX}%`]);
}

const octet = () => randomBytes(1)[0];

async function signInAsAdmin(page: Page) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin$/);
}

const rows = (page: Page) => page.getByRole("list", { name: "Chapters" }).getByRole("listitem");

async function addChapter(page: Page, title: string) {
  await page.getByLabel("Add a chapter").fill(title);
  await page.getByRole("button", { name: "Add", exact: true }).click();
}

test("a signed-out visitor to /admin/chapters ends on /sign-in", async ({ page }) => {
  await page.goto("/admin/chapters");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("the admin bar leads to the chapters page, which asks for a course", async ({ page }) => {
  await signInAsAdmin(page);
  await page.getByRole("link", { name: "Chapters", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/chapters$/);
  await expect(page.getByText("Choose a course to manage its chapters.")).toBeVisible();

  // An unknown course code is ignored, not an error.
  await page.goto("/admin/chapters?course=NOPE999");
  await expect(page.getByText("Choose a course to manage its chapters.")).toBeVisible();
  await expect(page.getByLabel("Course")).toHaveValue("");
});

test("a course with chapters lists them with their item counts", async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto("/admin/chapters?course=DEMO310");

  await expect(rows(page)).toHaveCount(6);
  await expect(rows(page).nth(0)).toContainText("Sample chapter 1");
  await expect(rows(page).nth(0)).toContainText(/\d+ items?/);
  await expect(rows(page).nth(5)).toContainText("Sample chapter 6");
  await expect(rows(page).nth(5)).toContainText("Empty");
  await expect(page.getByRole("link", { name: /View the course page/ })).toHaveAttribute("href", "/courses/DEMO310");
});

test.describe("managing chapters", () => {
  test.describe.configure({ mode: "serial" });

  let courseId: string;

  test.beforeAll(async () => {
    courseId = await demoCourseId();
  });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "writes to one shared course; desktop project only");
    await signInAsAdmin(page);
  });

  test("add, rename and reorder chapters", async ({ page }) => {
    try {
      await page.goto("/admin/chapters");
      await page.getByLabel("Course").selectOption("DEMO402");
      await page.getByRole("button", { name: "Apply" }).click();
      await expect(page).toHaveURL(/course=DEMO402/);
      await expect(page.getByText("This course has no chapters yet.")).toBeVisible();

      // A blank title is refused with a message under the field, and nothing is added.
      await addChapter(page, "   ");
      await expect(page.getByText("Enter a title of 1 to 200 characters.")).toBeVisible();
      await expect(rows(page)).toHaveCount(0);

      await addChapter(page, `${PREFIX} A`);
      await expect(rows(page)).toHaveCount(1);
      await expect(page.getByLabel("Add a chapter")).toHaveValue("");
      await addChapter(page, `${PREFIX} B`);
      await expect(rows(page)).toHaveCount(2);
      await expect(rows(page).nth(0)).toContainText(`${PREFIX} A`);
      await expect(rows(page).nth(1)).toContainText(`${PREFIX} B`);
      await expect(rows(page).nth(0)).toContainText("Empty");

      // Rename in place: Escape cancels, Enter saves.
      await page.getByRole("button", { name: `Rename ${PREFIX} A` }).click();
      const field = page.getByLabel(`New title for ${PREFIX} A`);
      await field.fill("discarded");
      await field.press("Escape");
      await expect(rows(page).nth(0)).toContainText(`${PREFIX} A`);
      await page.getByRole("button", { name: `Rename ${PREFIX} A` }).click();
      await page.getByLabel(`New title for ${PREFIX} A`).fill(`${PREFIX} A2`);
      await page.getByLabel(`New title for ${PREFIX} A`).press("Enter");
      await expect(rows(page).nth(0)).toContainText(`${PREFIX} A2`);

      // Only the outer buttons are disabled.
      await expect(page.getByRole("button", { name: `Move ${PREFIX} A2 up` })).toBeDisabled();
      await expect(page.getByRole("button", { name: `Move ${PREFIX} B down` })).toBeDisabled();

      await page.getByRole("button", { name: `Move ${PREFIX} B up` }).click();
      await expect(rows(page).nth(0)).toContainText(`${PREFIX} B`);
      await expect(rows(page).nth(1)).toContainText(`${PREFIX} A2`);
      await expect(page.getByRole("button", { name: `Move ${PREFIX} B up` })).toBeDisabled();
      await expect(page.getByRole("button", { name: `Move ${PREFIX} A2 down` })).toBeDisabled();
    } finally {
      await cleanUp(courseId);
    }
  });

  test("deleting an empty chapter asks first and leaves no sentence about items", async ({ page }) => {
    try {
      await page.goto("/admin/chapters?course=DEMO402");
      await addChapter(page, `${PREFIX} empty`);
      await expect(rows(page)).toHaveCount(1);

      await page.getByRole("button", { name: `Delete ${PREFIX} empty` }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText(`Delete “${PREFIX} empty”?`);
      await expect(dialog).not.toContainText("kept");
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(rows(page)).toHaveCount(1);

      await page.getByRole("button", { name: `Delete ${PREFIX} empty` }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
      // While the dialog is open the list behind it is hidden from the accessibility tree, so the
      // rows would count as 0 at once. The dialog closes only after the delete has been saved.
      await expect(page.getByRole("alertdialog")).toBeHidden();
      await expect(rows(page)).toHaveCount(0);
      await expect(page.getByText("This course has no chapters yet.")).toBeVisible();
    } finally {
      await cleanUp(courseId);
    }
  });

  test("deleting a chapter keeps its items, now without a chapter", async ({ page }) => {
    try {
      await page.goto("/admin/chapters?course=DEMO402");
      await addChapter(page, `${PREFIX} full`);
      await expect(rows(page)).toHaveCount(1);
      const [{ id: chapterId }] = await query<{ id: string }>("SELECT id FROM chapters WHERE course_id = $1 AND title = $2", [
        courseId,
        `${PREFIX} full`,
      ]);
      // A draft needs no file or link.
      await query(
        "INSERT INTO resources (course_id, chapter_id, type, title, is_published) VALUES ($1, $2, 'lecture', $3, false)",
        [courseId, chapterId, `${PREFIX} item`],
      );
      await page.reload();
      await expect(rows(page).nth(0)).toContainText("1 item");

      await page.getByRole("button", { name: `Delete ${PREFIX} full` }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText("Its 1 item is kept.");
      await dialog.getByRole("button", { name: "Delete" }).click();
      await expect(dialog).toBeHidden();
      await expect(rows(page)).toHaveCount(0);

      const left = await query<{ chapter_id: string | null }>("SELECT chapter_id FROM resources WHERE course_id = $1 AND title = $2", [
        courseId,
        `${PREFIX} item`,
      ]);
      expect(left).toEqual([{ chapter_id: null }]);
    } finally {
      await cleanUp(courseId);
    }
  });
});

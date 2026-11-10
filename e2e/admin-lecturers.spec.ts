import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// Needs the demo data and an admin. Uses its own lecturer names (E2E + random hex), and removes
// what it created in a `finally` block. Writing tests run in the desktop project only.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: CI passes the variables in the environment.
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

test.beforeAll(() => {
  expect(ADMIN_EMAIL && ADMIN_PASSWORD, "ADMIN_EMAIL and ADMIN_PASSWORD must be set").toBeTruthy();
});

async function withDb<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

async function deleteLecturers(like: string) {
  await withDb(async (client) => {
    await client.query("DELETE FROM resources WHERE lecturer_id IN (SELECT id FROM lecturers WHERE name LIKE $1)", [like]);
    await client.query("DELETE FROM lecturers WHERE name LIKE $1", [like]);
  });
}

const octet = () => randomBytes(1)[0];

async function signIn(page: Page, email: string, password: string) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}

test("the admin adds, renames and deletes a lecturer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "writing test, desktop only");
  const stamp = randomBytes(3).toString("hex");
  const name = `Dr. E2E Lecturer ${stamp}`;
  const slug = `e2e-lecturer-${stamp}`;
  const newName = `Pr. E2E Renamed ${stamp}`;
  try {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/admin");
    await page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Lecturers" }).click();
    await expect(page).toHaveURL(/\/admin\/lecturers$/);
    await expect(page.getByRole("heading", { name: "Lecturers", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lecturers", exact: true })).toHaveAttribute("aria-current", "page");

    // Add: the slug drops the title.
    const region = page.getByRole("region", { name: "Lecturers" });
    await region.getByLabel("Name").first().fill(`  ${name.replace("E2E Lecturer", "E2E   Lecturer")}  `);
    await region.getByRole("button", { name: "Add lecturer" }).click();
    await expect(page.getByText("Lecturer added.")).toBeVisible();
    await expect(region.getByLabel("Name").first()).toBeFocused();
    await expect(region.getByLabel("Name").first()).toHaveValue("");
    const row = page.getByRole("listitem").filter({ hasText: slug });
    await expect(row).toBeVisible();
    await expect(row).toContainText("0 files");

    // Duplicate, in another case.
    await region.getByLabel("Name").first().fill(name.toLowerCase());
    await region.getByRole("button", { name: "Add lecturer" }).click();
    await expect(page.getByText("A lecturer with this name already exists.")).toBeVisible();
    await expect(region.getByLabel("Name").first()).toHaveValue(name.toLowerCase());
    await region.getByLabel("Name").first().fill("   ");
    await region.getByRole("button", { name: "Add lecturer" }).click();
    await expect(page.getByText("Enter a name of 1 to 100 characters.")).toBeVisible();

    // Rename: the slug stays.
    await page.getByRole("button", { name: new RegExp(`^Edit .*${stamp}`) }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(`Renaming keeps the lecturer's address (?lecturer=${slug}).`)).toBeVisible();
    await dialog.getByLabel("Name").fill(newName);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Lecturer saved.")).toBeVisible();
    await expect(dialog).toBeHidden();
    const renamed = page.getByRole("listitem").filter({ hasText: newName });
    await expect(renamed).toContainText(slug);
    await expect(page.getByRole("button", { name: `Edit ${newName}` })).toBeFocused();

    // Delete is refused while a file uses the lecturer (a draft counts).
    await withDb(async (client) => {
      const course = await client.query("SELECT id FROM courses WHERE code = 'DEMO301'");
      await client.query(
        "INSERT INTO resources (course_id, type, title, language, is_published, lecturer_id) SELECT $1, 'lecture', 'E2E lecturer draft', 'en', false, id FROM lecturers WHERE slug = $2",
        [course.rows[0].id, slug],
      );
    });
    await page.reload();
    await expect(page.getByRole("listitem").filter({ hasText: newName })).toContainText("1 file");
    await page.getByRole("button", { name: `Delete ${newName}` }).click();
    const alert = page.getByRole("alertdialog");
    await expect(alert.getByText(`Delete ${newName}?`)).toBeVisible();
    await alert.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(alert.getByText(`${newName} is used by 1 file. Change or clear their lecturer first.`)).toBeVisible();
    await expect(alert.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();
    await alert.getByRole("button", { name: "Cancel" }).click();
    await withDb((client) => client.query("DELETE FROM resources WHERE title = 'E2E lecturer draft'"));

    // Delete once nothing uses it.
    await page.reload();
    await page.getByRole("button", { name: `Delete ${newName}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Lecturer deleted.")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: newName })).toHaveCount(0);
  } finally {
    await deleteLecturers(`%E2E%${stamp}%`);
  }
});

test("a student gets the not-found page and a visitor goes to sign-in", async ({ page }) => {
  await page.goto("/admin/lecturers");
  await expect(page).toHaveURL(/\/sign-in/);
  await signIn(page, "demo.student@example.com", "demo-student-password");
  await page.goto("/admin/lecturers");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toHaveCount(0);
});

import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// Needs the demo data and an admin. Uses its own course codes (E2E + random hex), never the demo
// courses, and removes what it created in a `finally` block. Writing tests run in the desktop project only.
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

// "_" matches any one character, so E2_STAMP covers both E2E... and E2F... codes.
async function deleteCourses(like: string) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("DELETE FROM courses WHERE code LIKE $1", [like]);
  } finally {
    await client.end();
  }
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

test("the admin adds, refuses a duplicate, and edits a course", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "writing test, desktop only");
  const stamp = randomBytes(3).toString("hex").toUpperCase();
  const code = `E2E${stamp}`;
  const newCode = `E2F${stamp}`;
  try {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/admin");
    await page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Courses" }).click();
    await expect(page).toHaveURL(/\/admin\/courses$/);
    await expect(page.getByRole("heading", { name: "Courses", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Courses", exact: true })).toHaveAttribute("aria-current", "page");

    // Add: lower case with a space is normalised.
    const add = page.getByRole("region", { name: "Courses" });
    await add.getByLabel("Code").first().fill(`e2e ${stamp.toLowerCase()}`);
    await add.getByLabel("Title").first().fill("E2E Course");
    await add.getByLabel("Semester").first().selectOption("5");
    await add.getByRole("button", { name: "Add course" }).click();
    await expect(page.getByText("Course added.")).toBeVisible();
    await expect(add.getByLabel("Code").first()).toBeFocused();
    await expect(add.getByLabel("Code").first()).toHaveValue("");
    const row = page.getByRole("listitem").filter({ hasText: code });
    await expect(row).toBeVisible();
    await expect(row).toContainText("0 resources");
    await expect(row).toContainText("0 chapters");

    // Public pages know the course at once.
    await page.goto(`/courses/${code}`);
    await expect(page.getByRole("heading", { name: "E2E Course" })).toBeVisible();

    // Duplicate, in another case.
    await page.goto("/admin/courses");
    await add.getByLabel("Code").first().fill(code.toLowerCase());
    await add.getByLabel("Title").first().fill("Again");
    await add.getByRole("button", { name: "Add course" }).click();
    await expect(page.getByText("A course with this code already exists.")).toBeVisible();
    await expect(add.getByLabel("Title").first()).toHaveValue("Again");

    // A bad code shows the field error.
    await add.getByLabel("Code").first().fill("I3-301");
    await add.getByRole("button", { name: "Add course" }).click();
    await expect(page.getByText("Use 2 to 20 letters and digits.")).toBeVisible();

    // Edit: new code, title and semester.
    const editButton = page.getByRole("button", { name: `Edit ${code}` });
    await editButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Changing the code changes the course's address (/courses/CODE).")).toBeVisible();
    await dialog.getByLabel("Code").fill(newCode);
    await dialog.getByLabel("Title").fill("E2E Renamed");
    await dialog.getByLabel("Semester").selectOption("6");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Course saved.")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: `Edit ${newCode}` })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: newCode })).toContainText("E2E Renamed");

    await page.goto(`/courses/${newCode}`);
    await expect(page.getByRole("heading", { name: "E2E Renamed" })).toBeVisible();
    await page.goto(`/courses/${code}`);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  } finally {
    await deleteCourses(`E2_${stamp}`);
  }
});

test("a student gets the not-found page and a visitor goes to sign-in", async ({ page }) => {
  await page.goto("/admin/courses");
  await expect(page).toHaveURL(/\/sign-in/);
  await signIn(page, "demo.student@example.com", "demo-student-password");
  await page.goto("/admin/courses");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin sections" })).toHaveCount(0);
});

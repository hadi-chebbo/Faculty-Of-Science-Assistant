import { randomBytes } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { Client } from "pg";

// Needs the demo data and an admin, like e2e/auth.spec.ts. Every resource created here is titled
// "E2E form ..." and removed again in a finally block. DEMO502 is used by no other spec.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: CI passes the variables in the environment.
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const COURSE = "DEMO502";
const COURSE_LABEL = "DEMO502 - Sample Course F";
// Six chapters, "Sample chapter 1" to "Sample chapter 6"; no other spec opens this course.
const CHAPTER_COURSE_LABEL = "DEMO510 - Sample Full Course C";
// Real rows of DEMO510 to link a solution to, and how the exam is labelled in the dropdown.
const LINKED_EXERCISE = "Sample exercise sheet 1.1";
const LINKED_EXAM = "Sample partial exam 2022";
const LINKED_EXAM_LABEL = `2022-2023 Partial - ${LINKED_EXAM}`;

test.beforeAll(() => {
  expect(ADMIN_EMAIL && ADMIN_PASSWORD, "ADMIN_EMAIL and ADMIN_PASSWORD must be set").toBeTruthy();
});

const octet = () => randomBytes(1)[0];
const uniqueTitle = () => `E2E form ${randomBytes(4).toString("hex")}`;

async function signInAsAdmin(page: Page) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin$/);
}

// Test-only lookup of the ids created by a test.
async function idsByTitle(title: string): Promise<string[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query("SELECT id FROM resources WHERE title = $1", [title]);
    return result.rows.map((row) => row.id as string);
  } finally {
    await client.end();
  }
}

// Test-only lookup of a resource's chapter position (null when it has no chapter).
async function chapterPositionOf(title: string): Promise<number | null> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      "SELECT c.position FROM resources r LEFT JOIN chapters c ON c.id = r.chapter_id WHERE r.title = $1",
      [title],
    );
    expect(result.rows).toHaveLength(1);
    return (result.rows[0].position as number | null) ?? null;
  } finally {
    await client.end();
  }
}

// Test-only lookup of the title of the resource a solution answers (null when it answers none).
async function solutionOfTitle(title: string): Promise<string | null> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      "SELECT t.title FROM resources r LEFT JOIN resources t ON t.id = r.solution_of_id WHERE r.title = $1",
      [title],
    );
    expect(result.rows).toHaveLength(1);
    return (result.rows[0].title as string | null) ?? null;
  } finally {
    await client.end();
  }
}

// Test-only lookup: no endpoint returns a course id.
async function courseIdOf(code: string): Promise<string> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query("SELECT id FROM courses WHERE code = $1", [code]);
    return result.rows[0].id as string;
  } finally {
    await client.end();
  }
}

// Test-only lookup of the stored academic year start (null when not set).
async function academicYearStartOf(title: string): Promise<number | null> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query("SELECT academic_year_start FROM resources WHERE title = $1", [title]);
    expect(result.rows).toHaveLength(1);
    return (result.rows[0].academic_year_start as number | null) ?? null;
  } finally {
    await client.end();
  }
}

// Test-only lookup of the stored file key (null when the resource has no file).
async function fileKeyOf(title: string): Promise<string | null> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query("SELECT file_key FROM resources WHERE title = $1", [title]);
    expect(result.rows).toHaveLength(1);
    return (result.rows[0].file_key as string | null) ?? null;
  } finally {
    await client.end();
  }
}

// Deletes through the API as a separate signed-in admin client, so a test that tampers with the
// browser's cookies cannot break its own cleanup.
async function cleanup(request: APIRequestContext, origin: string, title: string) {
  const signIn = await request.post("/api/v1/auth/sign-in", {
    headers: { origin, "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` },
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(signIn.status()).toBe(200);
  for (const id of await idsByTitle(title)) await request.delete(`/api/v1/resources/${id}`, { headers: { origin } });
}

async function fillBasics(page: Page, title: string) {
  await page.locator("#courseId").selectOption({ label: COURSE_LABEL });
  await page.getByLabel("Title", { exact: true }).fill(title);
}

// The form's controls: the type is a group of radio buttons named by their singular label ("Exam"),
// the visibility another ("Draft" / "Published"), and the one save button's name follows the visibility.
const chooseType = (page: Page, label: string) => page.getByRole("radio", { name: label, exact: true }).check();
const setVisibility = (page: Page, label: "Draft" | "Published") => page.getByRole("radio", { name: new RegExp(`^${label}`) }).check();
const save = (page: Page) => page.getByRole("button", { name: /^Save (draft|and publish)$/ }).click();

const rowFor =(page: Page, title: string) => page.getByRole("listitem").filter({ hasText: title });

test.describe("admin resource form", () => {
  let origin: string;

  test.beforeEach(({ baseURL }) => {
    origin = new URL(baseURL!).origin;
  });

  test("create a draft, then edit its title", async ({ page, request }) => {
    const title = uniqueTitle();
    const renamed = `${title} renamed`;
    try {
      await signInAsAdmin(page);
      await page.getByRole("link", { name: "New resource" }).click();
      // The list page has a "Course" filter too; wait until the form page has replaced it.
      await expect(page.getByRole("heading", { name: "New resource" })).toBeVisible();
      await fillBasics(page, title);
      await save(page);
      await page.waitForURL(/\/admin$/);

      await page.goto(`/admin?course=${COURSE}`);
      await expect(rowFor(page, title).getByText("Draft", { exact: true })).toBeVisible();

      await page.getByRole("link", { name: `Edit ${title}` }).click();
      await expect(page.getByRole("heading", { name: "Edit resource" })).toBeVisible();
      await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);
      await page.getByLabel("Title", { exact: true }).fill(renamed);
      await save(page);
      await page.waitForURL(/\/admin$/);

      await page.goto(`/admin?course=${COURSE}`);
      await expect(rowFor(page, renamed)).toBeVisible();
    } finally {
      await cleanup(request, origin, title);
      await cleanup(request, origin, renamed);
    }
  });

  test("validation: publishing without a link, and the exam session field", async ({ page, request }) => {
    const title = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/resources/new");
      await fillBasics(page, title);

      await setVisibility(page, "Published");
      await save(page);
      await expect(page.getByText("Add a file or link before publishing.")).toBeVisible();
      await expect(page.getByText("The resource was not saved.")).toBeVisible();
      await expect(page).toHaveURL(/\/admin\/resources\/new$/);

      await expect(page.getByLabel("Exam session")).toHaveCount(0);
      await chooseType(page, "Exam");
      await expect(page.getByLabel("Exam session")).toBeVisible();
      await chooseType(page, "Lecture");
      await expect(page.getByLabel("Exam session")).toHaveCount(0);

      expect(await idsByTitle(title)).toHaveLength(0);
    } finally {
      await cleanup(request, origin, title);
    }
  });

  test("a published lecture shows on the public course page", async ({ page, browser, request }) => {
    const title = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/resources/new");
      await fillBasics(page, title);
      await page.getByLabel("Backup link").fill("https://example.com/e2e");
      await setVisibility(page, "Published");
      await save(page);
      await page.waitForURL(/\/admin$/);

      const anonymous = await browser.newContext();
      try {
        const visitor = await anonymous.newPage();
        await visitor.goto(`/courses/${COURSE}`);
        await expect(visitor.getByText(title)).toBeVisible();
      } finally {
        await anonymous.close();
      }
    } finally {
      await cleanup(request, origin, title);
    }
  });

  test("an expired access token is renewed and the save still succeeds", async ({ page, request }) => {
    const title = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/resources/new");
      await fillBasics(page, title);

      await page.context().clearCookies({ name: "ua_access" });
      await save(page);
      await page.waitForURL(/\/admin$/);

      expect(await idsByTitle(title)).toHaveLength(1);
    } finally {
      await cleanup(request, origin, title);
    }
  });

  test("choose a chapter on create, change it on edit, and clear it", async ({ page, request }) => {
    const title = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/resources/new");
      await expect(page.getByLabel("Chapter")).toBeDisabled();
      await expect(page.getByLabel("Chapter")).toContainText("Choose a course first");

      await page.locator("#courseId").selectOption({ label: CHAPTER_COURSE_LABEL });
      await page.getByLabel("Title", { exact: true }).fill(title);
      await expect(page.getByLabel("Chapter")).toBeEnabled();
      await page.getByLabel("Chapter").selectOption({ label: "2. Sample chapter 2" });
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await chapterPositionOf(title)).toBe(2);

      const [id] = await idsByTitle(title);
      await page.goto(`/admin/resources/${id}/edit`);
      const chapter = page.getByLabel("Chapter");
      await expect(chapter.locator("option:checked")).toHaveText("2. Sample chapter 2");

      await chapter.selectOption({ label: "No chapter" });
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await chapterPositionOf(title)).toBeNull();

      await page.goto(`/admin/resources/${id}/edit`);
      await expect(chapter.locator("option:checked")).toHaveText("No chapter");
      await chapter.selectOption({ label: "3. Sample chapter 3" });
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await chapterPositionOf(title)).toBe(3);
    } finally {
      await cleanup(request, origin, title);
    }
  });

  test("changing the course resets the chapter; a course without chapters disables the field", async ({ page, request }) => {
    const title = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/resources/new");
      await page.locator("#courseId").selectOption({ label: CHAPTER_COURSE_LABEL });
      await page.getByLabel("Title", { exact: true }).fill(title);
      await page.getByLabel("Chapter").selectOption({ label: "4. Sample chapter 4" });

      await page.locator("#courseId").selectOption({ label: COURSE_LABEL });
      await expect(page.getByLabel("Chapter")).toBeDisabled();
      await expect(page.getByLabel("Chapter")).toContainText("No chapters in this course");
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await chapterPositionOf(title)).toBeNull();
    } finally {
      await cleanup(request, origin, title);
    }
  });

  test("the Chapter field is hidden for exams", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/resources/new");
    await page.locator("#courseId").selectOption({ label: CHAPTER_COURSE_LABEL });
    await expect(page.getByLabel("Chapter")).toBeVisible();
    await chooseType(page, "Exam");
    await expect(page.getByLabel("Chapter")).toHaveCount(0);
    await chooseType(page, "Lecture");
    await expect(page.getByLabel("Chapter")).toBeVisible();
  });

  test("the Solution of field appears only for type Solution", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/resources/new");
    await expect(page.getByLabel("Solution of", { exact: true })).toHaveCount(0);
    await chooseType(page, "Solution");
    await expect(page.getByLabel("Solution of", { exact: true })).toBeDisabled();
    await expect(page.getByLabel("Solution of", { exact: true })).toContainText("Choose a course first");
    await chooseType(page, "Lecture");
    await expect(page.getByLabel("Solution of", { exact: true })).toHaveCount(0);
  });

  test("link a solution to an exercise, change it to an exam, and unlink it", async ({ page, request }) => {
    const title = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/resources/new");
      await page.locator("#courseId").selectOption({ label: CHAPTER_COURSE_LABEL });
      await chooseType(page, "Solution");
      await page.getByLabel("Title", { exact: true }).fill(title);
      const solutionOf = page.getByLabel("Solution of", { exact: true });
      await expect(solutionOf).toBeEnabled();
      await expect(solutionOf.locator("option:checked")).toHaveText("Not linked");
      await solutionOf.selectOption({ label: LINKED_EXERCISE });
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await solutionOfTitle(title)).toBe(LINKED_EXERCISE);

      const [id] = await idsByTitle(title);
      await page.goto(`/admin/resources/${id}/edit`);
      await expect(solutionOf.locator("option:checked")).toHaveText(LINKED_EXERCISE);
      await expect(solutionOf.locator("optgroup")).toHaveCount(2);
      await expect(solutionOf.locator("option", { hasText: title })).toHaveCount(0);

      await solutionOf.selectOption({ label: LINKED_EXAM_LABEL });
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await solutionOfTitle(title)).toBe(LINKED_EXAM);

      await page.goto(`/admin/resources/${id}/edit`);
      await expect(solutionOf.locator("option:checked")).toHaveText(LINKED_EXAM_LABEL);
      await solutionOf.selectOption({ label: "Not linked" });
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await solutionOfTitle(title)).toBeNull();
    } finally {
      await cleanup(request, origin, title);
    }
  });

  test("changing the course resets Solution of and offers only that course's resources", async ({ page, request }) => {
    const title = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/resources/new");
      await page.locator("#courseId").selectOption({ label: CHAPTER_COURSE_LABEL });
      await chooseType(page, "Solution");
      await page.getByLabel("Title", { exact: true }).fill(title);
      const solutionOf = page.getByLabel("Solution of", { exact: true });
      await solutionOf.selectOption({ label: LINKED_EXERCISE });

      await page.locator("#courseId").selectOption({ label: COURSE_LABEL });
      await expect(solutionOf.locator("option:checked")).toHaveText("Not linked");
      await expect(solutionOf.locator("option", { hasText: LINKED_EXERCISE })).toHaveCount(0);
      await expect(solutionOf.locator("option", { hasText: "Sample exercise sheet 1" })).toHaveCount(1);
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await solutionOfTitle(title)).toBeNull();
    } finally {
      await cleanup(request, origin, title);
    }
  });

  test("New resource has no Delete button", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/resources/new");
    await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  });

  test("delete a draft from its edit page after confirming", async ({ page, request }) => {
    const title = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/resources/new");
      await fillBasics(page, title);
      await save(page);
      await page.waitForURL(/\/admin$/);

      const [id] = await idsByTitle(title);
      await page.goto(`/admin/resources/${id}/edit`);
      await page.getByRole("button", { name: "Delete" }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog.getByRole("heading", { name: `Delete “${title}”?` })).toBeVisible();
      await expect(dialog.getByText("This cannot be undone.")).toBeVisible();
      await expect(dialog.getByText("It is published")).toHaveCount(0);
      await expect(dialog.getByText("solution")).toHaveCount(0);

      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toHaveCount(0);
      expect(await idsByTitle(title)).toHaveLength(1);

      await page.getByRole("button", { name: "Delete" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
      await page.waitForURL(/\/admin$/);
      expect(await idsByTitle(title)).toHaveLength(0);
    } finally {
      await cleanup(request, origin, title);
    }
  });

  test("deleting an exercise keeps its solution and unlinks it", async ({ page, request }) => {
    const exercise = uniqueTitle();
    const solution = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/resources/new");
      await fillBasics(page, exercise);
      await chooseType(page, "Exercise");
      await save(page);
      await page.waitForURL(/\/admin$/);

      await page.goto("/admin/resources/new");
      await fillBasics(page, solution);
      await chooseType(page, "Solution");
      await page.getByLabel("Solution of", { exact: true }).selectOption({ label: exercise });
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await solutionOfTitle(solution)).toBe(exercise);

      const [id] = await idsByTitle(exercise);
      await page.goto(`/admin/resources/${id}/edit`);
      await page.getByRole("button", { name: "Delete" }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog.getByText("Its 1 solution is kept but will no longer be linked to it.")).toBeVisible();
      await dialog.getByRole("button", { name: "Delete" }).click();
      await page.waitForURL(/\/admin$/);

      expect(await idsByTitle(exercise)).toHaveLength(0);
      expect(await solutionOfTitle(solution)).toBeNull();
    } finally {
      await cleanup(request, origin, solution);
      await cleanup(request, origin, exercise);
    }
  });

  test("changing the type from Solution to Lecture stores no link",async ({ page, request }) => {
    const title = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/resources/new");
      await page.locator("#courseId").selectOption({ label: CHAPTER_COURSE_LABEL });
      await chooseType(page, "Solution");
      await page.getByLabel("Title", { exact: true }).fill(title);
      await page.getByLabel("Solution of", { exact: true }).selectOption({ label: LINKED_EXERCISE });
      await chooseType(page, "Lecture");
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await solutionOfTitle(title)).toBeNull();
    } finally {
      await cleanup(request, origin, title);
    }
  });

  test("the type chooser works with the arrow keys; Exam shows Exam session and hides Chapter", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/resources/new");
    const group = page.getByRole("group", { name: "Type" });
    await expect(group.getByRole("radio")).toHaveCount(6);
    await expect(group.getByRole("radio", { name: "Lecture", exact: true })).toBeChecked();
    await expect(page.getByLabel("Chapter")).toBeVisible();

    await group.getByRole("radio", { name: "Lecture", exact: true }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(group.getByRole("radio", { name: "Notes", exact: true })).toBeChecked();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(group.getByRole("radio", { name: "Exam", exact: true })).toBeChecked();
    await expect(page.getByLabel("Exam session")).toBeVisible();
    await expect(page.getByLabel("Chapter")).toHaveCount(0);
    await page.keyboard.press("ArrowUp");
    await expect(group.getByRole("radio", { name: "Exercise", exact: true })).toBeChecked();
    await expect(page.getByLabel("Exam session")).toHaveCount(0);
    await expect(page.getByLabel("Chapter")).toBeVisible();
  });

  test("the preview follows the title, language, year, chapter and type", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/resources/new");
    const preview = page.getByTestId("preview");
    const where = page.getByTestId("preview-where");
    await expect(preview).toContainText("Untitled");
    await expect(where).toHaveText("Choose a course to see where it will appear.");

    await page.locator("#courseId").selectOption({ label: CHAPTER_COURSE_LABEL });
    await page.getByLabel("Chapter").selectOption({ label: "2. Sample chapter 2" });
    await page.getByLabel("Title", { exact: true }).fill("Preview lecture");
    await page.getByLabel("Academic year").selectOption({ label: "2024-2025" });
    await page.getByRole("radio", { name: "French" }).check();
    await expect(preview).toContainText("Preview lecture");
    await expect(preview).toContainText("FR");
    await expect(preview).toContainText("2024-2025");
    await expect(where).toHaveText("In DEMO510 › Chapter 2 › Lectures");

    await page.getByLabel("Chapter").selectOption({ label: "No chapter" });
    await expect(where).toHaveText("In DEMO510 › Other material › Lectures");

    await chooseType(page, "Exam");
    await page.getByLabel("Exam session").selectOption({ label: "Final" });
    await expect(preview).toContainText("Final");
    await expect(where).toHaveText("In DEMO510 › Previous exams");
    await expect(preview.getByRole("listitem")).toHaveCount(0);
    await expect(preview.getByRole("link")).toHaveCount(0);
  });

  test("the save button follows the visibility choice", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/resources/new");
    await expect(page.getByRole("radio", { name: /^Draft/ })).toBeChecked();
    await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
    await setVisibility(page, "Published");
    await expect(page.getByRole("button", { name: "Save and publish" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
    await setVisibility(page, "Draft");
    await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
  });

  test("the edit page shows the stored status and the last saved date; New resource shows neither", async ({ page, request }) => {
    const title = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/resources/new");
      await expect(page.getByText("Last saved")).toHaveCount(0);
      await fillBasics(page, title);
      await save(page);
      await page.waitForURL(/\/admin$/);

      const [id] = await idsByTitle(title);
      await page.goto(`/admin/resources/${id}/edit`);
      const header = page.locator("main p").filter({ hasText: "Last saved" });
      await expect(header).toContainText("Draft");
      await expect(header).toContainText(/Last saved \d{1,2} \w{3,4} \d{4}/);
      // The pill shows the stored state: choosing Published does not change it before saving.
      await setVisibility(page, "Published");
      await expect(header).toContainText("Draft");
      await expect(header).not.toContainText("Published");

      await page.getByLabel("Backup link").fill("https://example.com/e2e");
      await save(page);
      await page.waitForURL(/\/admin$/);
      await page.goto(`/admin/resources/${id}/edit`);
      await expect(header).toContainText("Published");
      await expect(page.getByRole("radio", { name: /^Published/ })).toBeChecked();
    } finally {
      await cleanup(request, origin, title);
    }
  });

  test("the academic year dropdown saves the start year and shows a stored year outside the list", async ({ page, request }) => {
    const title = uniqueTitle();
    const old = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/resources/new");
      await fillBasics(page, title);
      const year = page.getByLabel("Academic year");
      await expect(year.locator("option:checked")).toHaveText("Not set");
      await year.selectOption({ label: "2024-2025" });
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await academicYearStartOf(title)).toBe(2024);

      const [id] = await idsByTitle(title);
      await page.goto(`/admin/resources/${id}/edit`);
      await expect(year.locator("option:checked")).toHaveText("2024-2025");
      await year.selectOption({ label: "Not set" });
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await academicYearStartOf(title)).toBeNull();

      // A year older than the 15 offered is created through the API, then must still be shown.
      const courseId = await courseIdOf(COURSE);
      const created = await page.request.post("/api/v1/resources", {
        headers: { origin },
        data: { courseId, type: "lecture", title: old, academicYearStart: 2001, isPublished: false },
      });
      expect(created.status()).toBe(201);
      const [oldId] = await idsByTitle(old);
      await page.goto(`/admin/resources/${oldId}/edit`);
      await expect(year.locator("option:checked")).toHaveText("2001-2002");
    } finally {
      await cleanup(request, origin, title);
      await cleanup(request, origin, old);
    }
  });
});

const pdfFile = (name = "lecture.pdf") => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from(`%PDF-1.4\n% E2E ${randomBytes(8).toString("hex")}\n%%EOF\n`),
});
const fileInput = (page: Page) => page.getByLabel("File", { exact: true });

// Deleting a resource through the API also removes its stored file.
test.describe("admin resource form: PDF upload", () => {
  let origin: string;

  test.beforeEach(({ baseURL }) => {
    origin = new URL(baseURL!).origin;
  });

  // The signed read URL of a resource's stored file, as the admin's own session gets it.
  async function readUrl(page: Page, id: string): Promise<string> {
    const open = await page.request.get(`/api/v1/resources/${id}/open`, { maxRedirects: 0 });
    expect(open.status()).toBe(307);
    return open.headers()["location"];
  }

  test("a chosen PDF uploads, is saved with the resource and opens from the edit page", async ({ page, request }) => {
    const title = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/resources/new");
      await fillBasics(page, title);
      await fileInput(page).setInputFiles(pdfFile("my lecture.pdf"));
      await expect(page.getByText("Ready. It is saved with the resource.")).toBeVisible();
      await expect(page.getByText("my lecture.pdf")).toBeVisible();
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await fileKeyOf(title)).toMatch(/^resources\/.+\.pdf$/);

      const [id] = await idsByTitle(title);
      await page.goto(`/admin/resources/${id}/edit`);
      await expect(page.getByText("A PDF is stored.")).toBeVisible();
      const link = page.getByRole("link", { name: "View current file" });
      await expect(link).toHaveAttribute("href", `/api/v1/resources/${id}/open`);
      await expect(link).toHaveAttribute("target", "_blank");
      const opened = await page.request.get(await readUrl(page, id));
      expect(opened.status()).toBe(200);
      expect(opened.headers()["content-type"]).toBe("application/pdf");
    } finally {
      await cleanup(request, origin, title);
    }
  });

  test("replacing the stored file changes the key and the old file is gone", async ({ page, request }) => {
    const title = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/resources/new");
      await fillBasics(page, title);
      await fileInput(page).setInputFiles(pdfFile());
      await expect(page.getByText("Ready. It is saved with the resource.")).toBeVisible();
      await save(page);
      await page.waitForURL(/\/admin$/);
      const firstKey = await fileKeyOf(title);
      const [id] = await idsByTitle(title);
      await page.goto(`/admin/resources/${id}/edit`);
      const oldUrl = await readUrl(page, id);
      expect((await page.request.get(oldUrl)).status()).toBe(200);

      await expect(page.getByText("A PDF is stored.")).toBeVisible();
      await fileInput(page).setInputFiles(pdfFile("second.pdf"));
      await expect(page.getByText("Ready. It is saved with the resource.")).toBeVisible();
      await expect(page.getByText("Replaces the stored file when you save.")).toBeVisible();
      await save(page);
      await page.waitForURL(/\/admin$/);

      const secondKey = await fileKeyOf(title);
      expect(secondKey).toMatch(/^resources\/.+\.pdf$/);
      expect(secondKey).not.toBe(firstKey);
      expect((await page.request.get(oldUrl)).status()).not.toBe(200);
      expect((await page.request.get(await readUrl(page, id))).status()).toBe(200);
    } finally {
      await cleanup(request, origin, title);
    }
  });

  test("a file that is not a PDF is refused in the browser with no upload request", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/resources/new");
    await fillBasics(page, uniqueTitle()); // also waits for the form to be interactive
    const uploadRequests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/v1/uploads") || r.url().includes("/api/v1/storage")) uploadRequests.push(r.url());
    });
    await fileInput(page).setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a pdf") });
    await expect(page.getByText("Choose a PDF file.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose PDF" })).toBeVisible();
    expect(uploadRequests).toEqual([]);
  });

  test("Remove after an upload leaves the resource without a file", async ({ page, request }) => {
    const title = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await page.goto("/admin/resources/new");
      await fillBasics(page, title);
      await fileInput(page).setInputFiles(pdfFile());
      await expect(page.getByText("Ready. It is saved with the resource.")).toBeVisible();
      await page.getByRole("button", { name: "Remove" }).click();
      await expect(page.getByRole("button", { name: "Choose PDF" })).toBeVisible();
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await fileKeyOf(title)).toBeNull();
    } finally {
      await cleanup(request, origin, title);
    }
  });

  test("the save button reads Uploading... and is disabled while the upload runs; Cancel returns to the empty box", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/resources/new");
    await fillBasics(page, uniqueTitle());
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/v1/storage/local*", async (route) => {
      await gate;
      await route.continue();
    });

    await fileInput(page).setInputFiles(pdfFile());
    const button = page.getByRole("button", { name: "Uploading..." });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(page.getByRole("progressbar", { name: "Upload progress" })).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: "Choose PDF" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Save draft$/ })).toBeEnabled();
    release();
  });

  test("a failed upload shows an error and the picker stays usable", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/resources/new");
    await fillBasics(page, uniqueTitle());
    await page.route("**/api/v1/storage/local*", (route) => route.fulfill({ status: 500 }));
    await fileInput(page).setInputFiles(pdfFile());
    await expect(page.getByText("The upload failed. Try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose PDF" })).toBeVisible();
  });
});

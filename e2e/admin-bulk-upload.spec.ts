import { randomBytes } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { Client } from "pg";

// Needs the demo data and an admin, like e2e/admin-resource-form.spec.ts. Every resource created here has a
// title ending in a random tag and is removed again in a finally block. DEMO510 has six chapters.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: CI passes the variables in the environment.
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const COURSE = "DEMO510";

test.beforeAll(() => {
  expect(ADMIN_EMAIL && ADMIN_PASSWORD, "ADMIN_EMAIL and ADMIN_PASSWORD must be set").toBeTruthy();
});

const octet = () => randomBytes(1)[0];
const tag = () => randomBytes(4).toString("hex");

async function signInAsAdmin(page: Page) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin$/);
}

async function rowsByTitle(title: string) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT r.id, r.type, r.is_published, r.exam_session, r.academic_year_start, r.file_key, c.position AS chapter
         FROM resources r LEFT JOIN chapters c ON c.id = r.chapter_id WHERE r.title = $1`,
      [title],
    );
    return result.rows as {
      id: string;
      type: string;
      is_published: boolean;
      exam_session: string | null;
      academic_year_start: number | null;
      file_key: string | null;
      chapter: number | null;
    }[];
  } finally {
    await client.end();
  }
}

async function cleanup(request: APIRequestContext, origin: string, titles: string[]) {
  const signIn = await request.post("/api/v1/auth/sign-in", {
    headers: { origin, "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` },
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(signIn.status()).toBe(200);
  for (const title of titles) {
    for (const { id } of await rowsByTitle(title)) await request.delete(`/api/v1/resources/${id}`, { headers: { origin } });
  }
}

// The file input only works once the page has loaded its scripts (a change before that is lost).
async function openBulk(page: Page, query = "") {
  await page.goto(`/admin/resources/bulk${query}`);
  await expect(page.getByRole("heading", { name: "Bulk upload" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

const pdf = (name: string) => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from(`%PDF-1.4\n% E2E ${randomBytes(8).toString("hex")}\n%%EOF\n`),
});
const filesInput = (page: Page) => page.getByLabel("PDF files", { exact: true });
const rowOf = (page: Page, fileName: string) => page.getByRole("listitem").filter({ hasText: fileName });
const saveButton = (page: Page, label: RegExp) => page.getByRole("button", { name: label });

test.describe("admin bulk upload", () => {
  let origin: string;

  test.beforeEach(({ baseURL }) => {
    origin = new URL(baseURL!).origin;
  });

  test("guesses details, files a chapter, skips a non-PDF and saves the rest as drafts", async ({ page, request }) => {
    const t = tag();
    const examFile = `final 2023-2024 ${t}.pdf`;
    const lectureFile = `lecture_graphs_${t}.pdf`;
    const textFile = `notes ${t}.txt`;
    const titles = [`final 2023-2024 ${t}`, `lecture graphs ${t}`];
    try {
      await signInAsAdmin(page);
      await page.goto(`/admin?course=${COURSE}`);
      await page.getByRole("link", { name: "Bulk upload" }).click();
      await expect(page.getByRole("heading", { name: "Bulk upload" })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(new RegExp(`course=${COURSE}`));
      await expect(page.locator("#bulk-course option:checked")).toContainText(COURSE);
      await expect(page.getByRole("radio", { name: /^Drafts/ })).toBeChecked();

      await filesInput(page).setInputFiles([
        pdf(examFile),
        pdf(lectureFile),
        { name: textFile, mimeType: "text/plain", buffer: Buffer.from("not a pdf") },
      ]);

      const exam = rowOf(page, examFile);
      await expect(exam.getByText("Uploaded.")).toBeVisible();
      await expect(exam.getByLabel(`Title for ${examFile}`)).toHaveValue(titles[0]);
      await expect(exam.getByLabel(`Type for ${examFile}`)).toHaveValue("exam");
      await expect(exam.getByLabel(`Session for ${examFile}`)).toHaveValue("final");
      await expect(exam.getByLabel(`Academic year for ${examFile}`)).toHaveValue("2023");
      // An exam has no chapter.
      await expect(exam.getByLabel(`Chapter for ${examFile}`)).toHaveCount(0);

      const lecture = rowOf(page, lectureFile);
      await expect(lecture.getByText("Uploaded.")).toBeVisible();
      await expect(lecture.getByLabel(`Title for ${lectureFile}`)).toHaveValue(titles[1]);
      await expect(lecture.getByLabel(`Type for ${lectureFile}`)).toHaveValue("lecture");
      await expect(lecture.getByLabel(`Session for ${lectureFile}`)).toHaveCount(0);
      await lecture.getByLabel(`Chapter for ${lectureFile}`).selectOption({ label: "1. Sample chapter 1" });

      const bad = rowOf(page, textFile);
      await expect(bad.getByRole("alert")).toHaveText("Choose a PDF file.");

      await saveButton(page, /^Save as drafts \(2\)/).click();
      await expect(page.getByText("2 saved.")).toBeVisible();
      await expect(exam).toHaveCount(0);
      await expect(lecture).toHaveCount(0);
      // The rejected file stays until the admin removes it.
      await expect(bad).toBeVisible();

      const [examRow] = await rowsByTitle(titles[0]);
      expect(examRow).toMatchObject({ type: "exam", is_published: false, exam_session: "final", academic_year_start: 2023, chapter: null });
      expect(examRow.file_key).toBeTruthy();
      const [lectureRow] = await rowsByTitle(titles[1]);
      expect(lectureRow).toMatchObject({ type: "lecture", is_published: false, chapter: 1 });

      await page.getByRole("link", { name: `See them in ${COURSE}` }).click();
      await expect(page).toHaveURL(new RegExp(`/admin\\?course=${COURSE}`));
      for (const title of titles) {
        await expect(page.getByRole("listitem").filter({ hasText: title }).getByText("Draft", { exact: true })).toBeVisible();
      }
    } finally {
      await cleanup(request, origin, titles);
    }
  });

  test("a published batch shows on the public course page", async ({ page, browser, request }) => {
    const t = tag();
    const file = `lecture trees ${t}.pdf`;
    const title = `lecture trees ${t}`;
    try {
      await signInAsAdmin(page);
      await openBulk(page, `?course=${COURSE}`);
      await page.getByRole("radio", { name: /^Published/ }).check();
      await filesInput(page).setInputFiles(pdf(file));
      await expect(rowOf(page, file).getByText("Uploaded.")).toBeVisible();
      await saveButton(page, /^Save and publish \(1\)/).click();
      await expect(page.getByText("1 saved.")).toBeVisible();
      expect((await rowsByTitle(title))[0].is_published).toBe(true);

      const anonymous = await browser.newContext();
      try {
        const visitor = await anonymous.newPage();
        await visitor.goto(`/courses/${COURSE}?tab=other`);
        await expect(visitor.getByText(title)).toBeVisible();
      } finally {
        await anonymous.close();
      }
    } finally {
      await cleanup(request, origin, [title]);
    }
  });

  test("Save needs a course and a valid row; a row the server refuses stays and can be sent again", async ({ page, request }) => {
    const t = tag();
    const file = `exam ${t}.pdf`;
    const title = `exam ${t}`;
    try {
      await signInAsAdmin(page);
      await openBulk(page);
      await filesInput(page).setInputFiles(pdf(file));
      const row = rowOf(page, file);
      await expect(row.getByText("Uploaded.")).toBeVisible();

      // No course yet, and an exam without a session.
      const save = saveButton(page, /^Save as drafts/);
      await expect(save).toBeDisabled();
      await expect(page.getByText("Choose a course to save.")).toBeVisible();
      await page.locator("#bulk-course").selectOption({ label: "DEMO510 - Sample Full Course C" });
      await expect(save).toBeDisabled();
      await expect(row.getByText("Choose a session.")).toBeVisible();
      await row.getByLabel(`Session for ${file}`).selectOption("partial");
      await expect(save).toBeEnabled();

      // The server refuses the file once.
      await page.route(
        "**/api/v1/resources",
        (route) =>
          route.request().method() === "POST"
            ? route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ fields: ["file"] }) })
            : route.fallback(),
        { times: 1 },
      );
      await save.click();
      await expect(row.getByRole("alert")).toContainText("The server did not accept this file");
      await expect(page.getByText(/\d+ saved\./)).toHaveCount(0);
      expect(await rowsByTitle(title)).toHaveLength(0);

      await row.getByRole("button", { name: `Retry upload of ${file}` }).click();
      await expect(row.getByText("Uploaded.")).toBeVisible();
      await saveButton(page, /^Save as drafts/).click();
      await expect(page.getByText("1 saved.")).toBeVisible();
      expect(await rowsByTitle(title)).toHaveLength(1);
    } finally {
      await cleanup(request, origin, [title]);
    }
  });

  test("changing the course asks first when a chapter was chosen; a row can be removed", async ({ page }) => {
    const t = tag();
    const file = `lecture ${t}.pdf`;
    await signInAsAdmin(page);
    await openBulk(page, `?course=${COURSE}`);
    await filesInput(page).setInputFiles(pdf(file));
    const row = rowOf(page, file);
    await expect(row.getByText("Uploaded.")).toBeVisible();
    await row.getByLabel(`Chapter for ${file}`).selectOption({ label: "2. Sample chapter 2" });

    await page.locator("#bulk-course").selectOption({ label: "DEMO502 - Sample Course F" });
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Change course" }).click();
    await expect(row.getByLabel(`Chapter for ${file}`)).toHaveValue("");

    await row.getByRole("button", { name: `Remove ${file}` }).click();
    await expect(row).toHaveCount(0);
  });
});

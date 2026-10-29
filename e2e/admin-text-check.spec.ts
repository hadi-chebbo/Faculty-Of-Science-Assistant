import { randomBytes } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { Client } from "pg";
import { samplePdf, scannedPdf } from "../src/lib/storage/sample-pdf";

// Needs the demo data and an admin, like e2e/admin-resource-form.spec.ts. Every resource created
// here is titled "E2E text ..." and removed again in a finally block. DEMO502 is shared with the
// form spec, which only looks at its own titles.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: CI passes the variables in the environment.
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const COURSE = "DEMO502";
const COURSE_LABEL = "DEMO502 - Sample Course F";

test.beforeAll(() => {
  expect(ADMIN_EMAIL && ADMIN_PASSWORD, "ADMIN_EMAIL and ADMIN_PASSWORD must be set").toBeTruthy();
});

const octet = () => randomBytes(1)[0];
const uniqueTitle = () => `E2E text ${randomBytes(4).toString("hex")}`;

async function signInAsAdmin(page: Page) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin$/);
}

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

async function columnsOf(title: string): Promise<{ page_count: number | null; text_page_count: number | null }> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query("SELECT page_count, text_page_count FROM resources WHERE title = $1", [title]);
    expect(result.rows).toHaveLength(1);
    return result.rows[0];
  } finally {
    await client.end();
  }
}

async function cleanup(request: APIRequestContext, origin: string, title: string) {
  const signIn = await request.post("/api/v1/auth/sign-in", {
    headers: { origin, "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` },
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(signIn.status()).toBe(200);
  for (const id of await idsByTitle(title)) await request.delete(`/api/v1/resources/${id}`, { headers: { origin } });
}

const pdf = (bytes: Uint8Array, name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from(bytes) });
const fileInput = (page: Page) => page.getByLabel("File", { exact: true });
const rowFor = (page: Page, title: string) => page.getByRole("listitem").filter({ hasText: title });

async function createWithFile(page: Page, title: string, file: ReturnType<typeof pdf>) {
  await page.goto("/admin/resources/new");
  // The file input only works once the page has loaded its scripts.
  await page.waitForLoadState("networkidle");
  await page.locator("#courseId").selectOption({ label: COURSE_LABEL });
  await page.getByLabel("Title", { exact: true }).fill(title);
  await fileInput(page).setInputFiles(file);
  await expect(page.getByText("Ready. It is saved with the resource.")).toBeVisible();
}

const save = (page: Page) => page.getByRole("button", { name: /^Save (draft|and publish)$/ }).click();

test.describe("scanned PDF check", () => {
  let origin: string;

  test.beforeEach(({ baseURL }) => {
    origin = new URL(baseURL!).origin;
  });

  test("a scanned PDF is flagged before saving, in the list, by the filter and on the edit page", async ({ page, request }) => {
    const scanned = uniqueTitle();
    const digital = uniqueTitle();
    try {
      await signInAsAdmin(page);

      await createWithFile(page, scanned, pdf(scannedPdf(2), "scan.pdf"));
      await expect(page.getByTestId("text-check-note")).toHaveText("Scanned: no text found in 2 pages");
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await columnsOf(scanned)).toEqual({ page_count: 2, text_page_count: 0 });

      await createWithFile(page, digital, pdf(samplePdf(["A digital heading", "A line of body text that is long enough to count."], 2), "digital.pdf"));
      await expect(page.getByTestId("text-check-note")).toHaveCount(0);
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await columnsOf(digital)).toEqual({ page_count: 2, text_page_count: 2 });

      await page.goto(`/admin?course=${COURSE}`);
      await expect(rowFor(page, scanned).getByTestId("text-layer-badge")).toHaveText(/Scanned/);
      await expect(rowFor(page, scanned).getByTestId("text-layer-badge")).toHaveAttribute("title", "0 of 2 pages have text");
      await expect(rowFor(page, digital)).toBeVisible();
      await expect(rowFor(page, digital).getByTestId("text-layer-badge")).toHaveCount(0);

      await page.goto(`/admin?course=${COURSE}&text=scanned`);
      await expect(rowFor(page, scanned)).toBeVisible();
      await expect(rowFor(page, digital)).toHaveCount(0);

      // The control sets the same address.
      await page.goto(`/admin?course=${COURSE}`);
      await page.getByLabel("Scanned or partly scanned only").check();
      await page.getByRole("button", { name: "Apply" }).click();
      await expect(page).toHaveURL(/text=scanned/);
      await expect(rowFor(page, scanned)).toBeVisible();

      await page.goto(`/admin/resources/${(await idsByTitle(scanned))[0]}/edit`);
      await expect(page.getByTestId("stored-text-check")).toContainText("Text: 0 of 2 pages");
      await expect(page.getByTestId("stored-text-check").getByTestId("text-layer-badge")).toBeVisible();
      await page.goto(`/admin/resources/${(await idsByTitle(digital))[0]}/edit`);
      await expect(page.getByTestId("stored-text-check")).toContainText("Text: 2 of 2 pages");
      await expect(page.getByTestId("stored-text-check").getByTestId("text-layer-badge")).toHaveCount(0);
    } finally {
      await cleanup(request, origin, scanned);
      await cleanup(request, origin, digital);
    }
  });

  test("a file PDF.js cannot read still uploads and saves, as not checked", async ({ page, request }) => {
    const title = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await createWithFile(page, title, pdf(new TextEncoder().encode(`%PDF-1.4\n% E2E ${randomBytes(6).toString("hex")}\n%%EOF\n`), "broken.pdf"));
      await expect(page.getByTestId("text-check-note")).toHaveCount(0);
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await columnsOf(title)).toEqual({ page_count: null, text_page_count: null });
      await page.goto(`/admin/resources/${(await idsByTitle(title))[0]}/edit`);
      await expect(page.getByTestId("stored-text-check")).toHaveText("Not checked");
    } finally {
      await cleanup(request, origin, title);
    }
  });

  test("replacing the file re-checks it, and editing other fields keeps the result", async ({ page, request }) => {
    const title = uniqueTitle();
    try {
      await signInAsAdmin(page);
      await createWithFile(page, title, pdf(scannedPdf(3), "scan.pdf"));
      await save(page);
      await page.waitForURL(/\/admin$/);

      const id = (await idsByTitle(title))[0];
      await page.goto(`/admin/resources/${id}/edit`);
      await page.getByLabel("Title", { exact: true }).fill(`${title} b`);
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await columnsOf(`${title} b`)).toEqual({ page_count: 3, text_page_count: 0 });

      await page.goto(`/admin/resources/${id}/edit`);
      // The file input only works once the page has loaded its scripts.
      await page.waitForLoadState("networkidle");
      await fileInput(page).setInputFiles(pdf(samplePdf(["A digital heading", "A line of body text that is long enough to count."], 1), "digital.pdf"));
      await expect(page.getByText("Ready. It is saved with the resource.")).toBeVisible();
      await save(page);
      await page.waitForURL(/\/admin$/);
      expect(await columnsOf(`${title} b`)).toEqual({ page_count: 1, text_page_count: 1 });
    } finally {
      await cleanup(request, origin, title);
      await cleanup(request, origin, `${title} b`);
    }
  });

  test("bulk upload flags a partly scanned row and saves the result with each file", async ({ page, request }) => {
    const scanned = uniqueTitle();
    const digital = uniqueTitle();
    const scanName = `scan-${randomBytes(3).toString("hex")}.pdf`;
    const digitalName = `digital-${randomBytes(3).toString("hex")}.pdf`;
    try {
      await signInAsAdmin(page);
      await page.goto(`/admin/resources/bulk?course=${COURSE}`);
      await expect(page.getByRole("heading", { name: "Bulk upload" })).toBeVisible();
      // The file input only works once the page has loaded its scripts.
      await page.waitForLoadState("networkidle");
      await page.getByLabel("PDF files", { exact: true }).setInputFiles([
        pdf(scannedPdf(5, [1, 2]), scanName),
        pdf(samplePdf(["A digital heading", "A line of body text that is long enough to count."], 1), digitalName),
      ]);
      const scanRow = page.getByRole("listitem").filter({ hasText: scanName });
      const digitalRow = page.getByRole("listitem").filter({ hasText: digitalName });
      await expect(scanRow.getByText("Uploaded.")).toBeVisible();
      await expect(digitalRow.getByText("Uploaded.")).toBeVisible();
      await expect(scanRow.getByTestId("text-check-note")).toHaveText("Partly scanned: 2 of 5 pages have text");
      await expect(digitalRow.getByTestId("text-check-note")).toHaveCount(0);

      await scanRow.getByLabel(`Title for ${scanName}`).fill(scanned);
      await digitalRow.getByLabel(`Title for ${digitalName}`).fill(digital);
      await page.getByRole("button", { name: /^Save as drafts/ }).click();
      await expect(page.getByText("2 saved.")).toBeVisible();

      expect(await columnsOf(scanned)).toEqual({ page_count: 5, text_page_count: 2 });
      expect(await columnsOf(digital)).toEqual({ page_count: 1, text_page_count: 1 });
    } finally {
      await cleanup(request, origin, scanned);
      await cleanup(request, origin, digital);
    }
  });
});

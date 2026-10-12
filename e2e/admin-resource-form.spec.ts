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

const rowFor = (page: Page, title: string) => page.getByRole("listitem").filter({ hasText: title });

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
      await page.getByRole("button", { name: "Save" }).click();
      await page.waitForURL(/\/admin$/);

      await page.goto(`/admin?course=${COURSE}`);
      await expect(rowFor(page, title).getByText("Draft", { exact: true })).toBeVisible();

      await page.getByRole("link", { name: `Edit ${title}` }).click();
      await expect(page.getByRole("heading", { name: "Edit resource" })).toBeVisible();
      await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);
      await page.getByLabel("Title", { exact: true }).fill(renamed);
      await page.getByRole("button", { name: "Save" }).click();
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

      await page.getByLabel("Published").check();
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Add a link before publishing.")).toBeVisible();
      await expect(page.getByText("The resource was not saved.")).toBeVisible();
      await expect(page).toHaveURL(/\/admin\/resources\/new$/);

      await expect(page.getByLabel("Exam session")).toHaveCount(0);
      await page.getByLabel("Type", { exact: true }).selectOption("exam");
      await expect(page.getByLabel("Exam session")).toBeVisible();
      await page.getByLabel("Type", { exact: true }).selectOption("lecture");
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
      await page.getByLabel("Link", { exact: true }).fill("https://example.com/e2e");
      await page.getByLabel("Published").check();
      await page.getByRole("button", { name: "Save" }).click();
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
      await page.getByRole("button", { name: "Save" }).click();
      await page.waitForURL(/\/admin$/);

      expect(await idsByTitle(title)).toHaveLength(1);
    } finally {
      await cleanup(request, origin, title);
    }
  });
});

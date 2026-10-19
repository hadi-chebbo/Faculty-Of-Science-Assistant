import { expect, test, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import pg from "pg";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed
// Locally the URL lives in .env, which Next.js loads for the server but not for this process.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the connection below fails with a clear error.
  }
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const UNKNOWN_ID = "33333333-3333-4333-8333-333333333333";

// Ids are read straight from the database; there is deliberately no API that lists them.
async function resourceId(courseCode: string, title: string): Promise<{ id: string }> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT r.id FROM resources r JOIN courses c ON c.id = r.course_id
       WHERE c.code = $1 AND r.title = $2`,
      [courseCode, title],
    );
    expect(rows).toHaveLength(1);
    return { id: rows[0].id };
  } finally {
    await client.end();
  }
}

// A link-only DRAFT, made for one test and always removed again. A published resource needs a file,
// so the link redirect can only be reached for a draft, which the admin may open.
// (Every seeded resource has a stored file, which wins over its link.)
async function withLinkOnlyResource<T>(run: (resource: { id: string; externalUrl: string }) => Promise<T>): Promise<T> {
  const externalUrl = "https://example.com/e2e/link-only";
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let id: string | undefined;
  try {
    const { rows } = await client.query(
      `INSERT INTO resources (course_id, type, title, language, external_url, is_published)
       SELECT id, 'other', $2, 'en', $3, false FROM courses WHERE code = $1 RETURNING id`,
      ["DEMO301", `E2E link-only ${randomUUID()}`, externalUrl],
    );
    id = rows[0].id as string;
    return await run({ id, externalUrl });
  } finally {
    if (id) await client.query("DELETE FROM resources WHERE id = $1", [id]);
    await client.end();
  }
}

// Signs the request context in as the admin (its cookies are kept for the next requests).
async function signInAsAdmin(request: APIRequestContext, baseURL: string | undefined) {
  expect(ADMIN_EMAIL && ADMIN_PASSWORD, "ADMIN_EMAIL and ADMIN_PASSWORD must be set").toBeTruthy();
  const octet = () => Math.floor(Math.random() * 256);
  const response = await request.post("/api/v1/auth/sign-in", {
    headers: { origin: new URL(baseURL!).origin, "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` },
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.status()).toBe(200);
}

test.describe("GET /api/v1/resources/[id]/open", () => {
  test("redirects a seeded resource to its stored PDF, uncached", async ({ request }) => {
    const { id } = await resourceId("DEMO301", "Sample lecture 1");
    const response = await request.get(`/api/v1/resources/${id}/open`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["cache-control"]).toBe("no-store");
    const served = await request.get(response.headers()["location"]);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toBe("application/pdf");
    expect((await served.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  test("redirects a link-only draft to its link for the admin, uncached", async ({ request, baseURL }) => {
    await withLinkOnlyResource(async ({ id, externalUrl }) => {
      const anonymous = await request.get(`/api/v1/resources/${id}/open`, { maxRedirects: 0 });
      expect(anonymous.status()).toBe(404);
      await signInAsAdmin(request, baseURL);
      const response = await request.get(`/api/v1/resources/${id}/open`, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      expect(response.headers()["location"]).toBe(externalUrl);
      expect(externalUrl).toMatch(/^https:\/\//);
      expect(response.headers()["cache-control"]).toBe("no-store");
    });
  });

  test("answers 404 for an unknown id, a malformed id and a draft", async ({ request }) => {
    const draft = await resourceId("DEMO501", "Sample draft lecture");
    for (const id of [UNKNOWN_ID, "not-a-uuid", draft.id]) {
      const response = await request.get(`/api/v1/resources/${id}/open`, { maxRedirects: 0 });
      expect(response.status(), id).toBe(404);
      expect(response.headers()["cache-control"]).toBe("no-store");
      expect(response.headers()["location"]).toBeUndefined();
    }
  });
});

test.describe("GET /api/v1/resources/[id]/open for a browser", () => {
  const HTML = { Accept: "text/html,application/xhtml+xml,*/*;q=0.8" };

  test("redirects every failure to the friendly page, uncached", async ({ request }) => {
    const draft = await resourceId("DEMO501", "Sample draft lecture");
    for (const id of [UNKNOWN_ID, "not-a-uuid", draft.id]) {
      const response = await request.get(`/api/v1/resources/${id}/open`, { maxRedirects: 0, headers: HTML });
      expect(response.status(), id).toBe(307);
      expect(response.headers()["location"]).toBe("/resource-unavailable");
      expect(response.headers()["cache-control"]).toBe("no-store");
    }
  });

  test("still redirects a working resource to its stored PDF", async ({ request }) => {
    const { id } = await resourceId("DEMO301", "Sample lecture 1");
    const response = await request.get(`/api/v1/resources/${id}/open`, { maxRedirects: 0, headers: HTML });
    expect(response.status()).toBe(307);
    const served = await request.get(response.headers()["location"]);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toBe("application/pdf");
    expect((await served.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  test("still redirects a link-only draft to its link for the admin", async ({ request, baseURL }) => {
    await withLinkOnlyResource(async ({ id, externalUrl }) => {
      await signInAsAdmin(request, baseURL);
      const response = await request.get(`/api/v1/resources/${id}/open`, { maxRedirects: 0, headers: HTML });
      expect(response.status()).toBe(307);
      expect(response.headers()["location"]).toBe(externalUrl);
    });
  });

  test("keeps the JSON answer for clients that do not accept HTML", async ({ request }) => {
    const response = await request.get(`/api/v1/resources/${UNKNOWN_ID}/open`, {
      maxRedirects: 0,
      headers: { Accept: "application/json" },
    });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "Resource not found" });
  });

  test("a browser that opens an unknown resource ends on the friendly page", async ({ page }) => {
    await page.goto(`/api/v1/resources/${UNKNOWN_ID}/open`);
    await expect(page).toHaveURL(/\/resource-unavailable$/);
    await expect(page.getByRole("heading", { name: "Resource unavailable" })).toBeVisible();
    await expect(page.getByText(/may have been removed, or it is not available yet/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("link", { name: "Browse exams" })).toHaveAttribute("href", "/exams");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});

test("resource rows on a course page open the reader page in the same tab", async ({ page }) => {
  // DEMO401 has no chapters, so its rows are on the by-type tabs.
  await page.goto("/courses/DEMO401");
  const row = page.getByRole("link", { name: /Sample lecture 1/ });
  await expect(row).not.toHaveAttribute("target", /.+/);
  await expect(row).toHaveAttribute("href", /^\/resources\/[0-9a-f-]{36}$/);

  await page.getByRole("tab", { name: /Exams/ }).click();
  const solution = page.getByRole("link", { name: /^Solution/ });
  await expect(solution).toHaveCount(1);
  await expect(solution).not.toHaveAttribute("target", /.+/);
  await expect(solution).toHaveAttribute("href", /^\/resources\/[0-9a-f-]{36}$/);
});

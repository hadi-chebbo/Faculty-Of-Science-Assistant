import { expect, test } from "@playwright/test";
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

const UNKNOWN_ID = "33333333-3333-4333-8333-333333333333";

// Ids are read straight from the database; there is deliberately no API that lists them.
async function resourceId(courseCode: string, title: string): Promise<{ id: string; externalUrl: string }> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT r.id, r.external_url FROM resources r JOIN courses c ON c.id = r.course_id
       WHERE c.code = $1 AND r.title = $2`,
      [courseCode, title],
    );
    expect(rows).toHaveLength(1);
    return { id: rows[0].id, externalUrl: rows[0].external_url };
  } finally {
    await client.end();
  }
}

test.describe("GET /api/v1/resources/[id]/open", () => {
  test("redirects a published resource to its link, uncached", async ({ request }) => {
    const { id, externalUrl } = await resourceId("DEMO301", "Sample lecture 1");
    const response = await request.get(`/api/v1/resources/${id}/open`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe(externalUrl);
    expect(externalUrl).toMatch(/^https:\/\//);
    expect(response.headers()["cache-control"]).toBe("no-store");
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

  test("still redirects a working resource to its link", async ({ request }) => {
    const { id, externalUrl } = await resourceId("DEMO301", "Sample lecture 1");
    const response = await request.get(`/api/v1/resources/${id}/open`, { maxRedirects: 0, headers: HTML });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe(externalUrl);
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

test("resource rows on a course page open in a new tab through the API route", async ({ page }) => {
  // DEMO401 has no chapters, so its rows are on the by-type tabs.
  await page.goto("/courses/DEMO401");
  const row = page.getByRole("link", { name: /Sample lecture 1/ });
  await expect(row).toHaveAttribute("target", "_blank");
  await expect(row).toHaveAttribute("rel", /noopener/);
  await expect(row).toHaveAttribute("href", /^\/api\/v1\/resources\/[0-9a-f-]{36}\/open$/);

  await page.getByRole("tab", { name: /Exams/ }).click();
  const solution = page.getByRole("link", { name: /^Solution/ });
  await expect(solution).toHaveCount(1);
  await expect(solution).toHaveAttribute("target", "_blank");
  await expect(solution).toHaveAttribute("href", /^\/api\/v1\/resources\/[0-9a-f-]{36}\/open$/);
});

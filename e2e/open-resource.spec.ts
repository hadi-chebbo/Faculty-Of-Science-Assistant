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

test("resource rows on a course page open in a new tab through the API route", async ({ page }) => {
  await page.goto("/courses/DEMO301");
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

import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";

// Needs the demo data (SEED_DEMO_DATA=true npm run db:seed, STORAGE_DRIVER=local). Each project
// (desktop, phone) uses a fresh confirmed student of its own, created and deleted here, so the
// milestone it earns touches no other spec.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the connection below fails with a clear error.
  }
}

const DEMO_EMAIL = "demo.student@example.com";
const PASSWORD = "demo-student-password";

async function withDb<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

test("the first mark shows the milestone toast and the Progress page shows it earned", async ({ page, isMobile }) => {
  const email = `milestones-${isMobile ? "phone" : "desktop"}@example.com`;
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  const resourceId = await withDb(async (client) => {
    await client.query(`DELETE FROM users WHERE email = $1`, [email]);
    await client.query(
      `INSERT INTO users (email, name, password_hash, role, email_confirmed_at, created_at, updated_at)
       SELECT $1, 'Milestones', password_hash, 'student', now(), now(), now() FROM users WHERE email = $2`,
      [email, DEMO_EMAIL],
    );
    const { rows } = await client.query(
      `SELECT r.id FROM resources r JOIN courses c ON c.id = r.course_id WHERE c.code = 'DEMO601' AND r.title = 'Sample notes'`,
    );
    expect(rows).toHaveLength(1);
    return rows[0].id as string;
  });
  try {
    const next = `/resources/${resourceId}`;
    await page.goto("/sign-in?next=" + encodeURIComponent(next));
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(next);

    const details = page.getByRole("complementary", { name: "About this file" });
    const saved = page.waitForResponse((r) => r.url().includes("/api/v1/completions/") && r.request().method() === "PUT" && r.ok());
    await details.getByRole("button", { name: "Mark as done" }).click();
    await saved;
    await expect(page.getByText("Milestone: First file done")).toBeVisible();

    await page.goto("/progress");
    const list = page.getByRole("list", { name: "Milestones" });
    await expect(list.getByRole("listitem")).toHaveCount(6);
    await expect(list.getByRole("listitem").filter({ hasText: "First file done, earned" })).toHaveAttribute("data-state", "earned");
    await expect(list.getByText("10 files done, not yet earned")).toBeAttached();
    await expect(page.getByRole("heading", { name: /Milestones · 1 of 6/i })).toBeVisible();
  } finally {
    await withDb((client) => client.query(`DELETE FROM users WHERE email = $1`, [email]));
  }
});

import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

// Needs the demo data. The long lecturer strip uses its own course and lecturers (E2E + random hex),
// removed in afterAll.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: CI passes the variables in the environment.
}

async function withDb<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

test("course page: a back link to the year on a phone, the breadcrumb on desktop", async ({ page, isMobile }) => {
  await page.goto("/courses/DEMO301");
  const back = page.getByRole("link", { name: "Back to Second year" });
  if (isMobile) {
    await expect(back).toBeVisible();
    await expect(back).toHaveText("Second year");
    await expect(back).toHaveAttribute("href", "/years/2#semester-1");
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeHidden();
    await back.click();
    await expect(page).toHaveURL(/\/years\/2#semester-1$/);
  } else {
    await expect(back).toBeHidden();
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs).toBeVisible();
    await expect(crumbs.getByRole("link", { name: "Second year" })).toHaveAttribute("href", "/years/2#semester-1");
  }
});

test("chapter page: a back link to the course on a phone, keeping the chosen lecturer", async ({ page, isMobile }) => {
  await page.goto("/courses/DEMO301/chapters/1?lecturer=ada-example");
  const back = page.getByRole("link", { name: "Back to DEMO301" });
  if (isMobile) {
    await expect(back).toBeVisible();
    await expect(back).toHaveText("DEMO301");
    await expect(back).toHaveAttribute("href", "/courses/DEMO301?lecturer=ada-example");
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  } else {
    await expect(back).toBeHidden();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "DEMO301" }),
    ).toHaveAttribute("href", "/courses/DEMO301?lecturer=ada-example");
  }
});

test.describe("a course with five lecturers", () => {
  const stamp = randomBytes(3).toString("hex");
  const code = `E2EBL${stamp}`.toUpperCase();

  test.beforeAll(async () => {
    await withDb(async (client) => {
      const course = await client.query(
        "INSERT INTO courses (code, title, semester) VALUES ($1, 'E2E many lecturers', 3) RETURNING id",
        [code],
      );
      for (let i = 1; i <= 5; i++) {
        const lecturer = await client.query("INSERT INTO lecturers (name, slug) VALUES ($1, $2) RETURNING id", [
          `Dr. E2E Strip ${stamp} ${i}`,
          `e2e-strip-${stamp}-${i}`,
        ]);
        await client.query(
          `INSERT INTO resources (course_id, type, title, language, file_key, is_published, lecturer_id)
           VALUES ($1, 'lecture', $2, 'en', $3, true, $4)`,
          [course.rows[0].id, `E2E strip file ${i}`, `resources/e2e-strip-${stamp}-${i}.pdf`, lecturer.rows[0].id],
        );
      }
    });
  });

  test.afterAll(async () => {
    await withDb(async (client) => {
      await client.query("DELETE FROM resources WHERE course_id IN (SELECT id FROM courses WHERE code = $1)", [code]);
      await client.query("DELETE FROM courses WHERE code = $1", [code]);
      await client.query("DELETE FROM lecturers WHERE slug LIKE $1", [`e2e-strip-${stamp}-%`]);
    });
  });

  test("the Taught by strip is one sideways-scrolling row", async ({ page, isMobile }) => {
    await page.goto(`/courses/${code}`);
    const strip = page.getByRole("list", { name: "Lecturer" });
    await expect(strip).toHaveAttribute("data-layout", "row");
    const cards = strip.getByRole("listitem");
    await expect(cards).toHaveCount(6);
    const tops = await cards.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    // Six 192px cards fit a desktop width; on a phone the row scrolls sideways.
    if (isMobile) expect(await strip.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  });
});

test("a course with fewer than five lecturers keeps the grid", async ({ page }) => {
  await page.goto("/courses/DEMO301");
  await expect(page.getByRole("list", { name: "Lecturer" })).toHaveAttribute("data-layout", "grid");
});

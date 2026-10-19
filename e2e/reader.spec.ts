import { expect, test } from "@playwright/test";
import pg from "pg";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed (with STORAGE_DRIVER=local).
// Locally the URL lives in .env, which Next.js loads for the server but not for this process.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the connection below fails with a clear error.
  }
}

const UNKNOWN_ID = "33333333-3333-4333-8333-333333333333";
const HTML = { Accept: "text/html,application/xhtml+xml,*/*;q=0.8" };

async function resourceId(courseCode: string, title: string): Promise<string> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT r.id FROM resources r JOIN courses c ON c.id = r.course_id
       WHERE c.code = $1 AND r.title = $2`,
      [courseCode, title],
    );
    expect(rows).toHaveLength(1);
    return rows[0].id;
  } finally {
    await client.end();
  }
}

test.describe("the reader page", () => {
  test("a course page row opens it in the same tab", async ({ page }) => {
    const id = await resourceId("DEMO401", "Sample lecture 1");
    await page.goto("/courses/DEMO401");
    await page.getByRole("link", { name: /Sample lecture 1/ }).click();
    await expect(page).toHaveURL(new RegExp(`/resources/${id}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Sample lecture 1" })).toBeVisible();
  });

  test("shows the title, a drawn page and the page counter", async ({ page }) => {
    const id = await resourceId("DEMO301", "Sample lecture 1");
    await page.goto(`/resources/${id}`);
    await expect(page).toHaveTitle("Sample lecture 1 (DEMO301) | University Assistant");
    await expect(page.getByRole("heading", { level: 1, name: "Sample lecture 1" })).toBeVisible();
    await expect(page.getByText("Lecture · English")).toBeVisible();

    const canvas = page.getByRole("img", { name: "Page 1 of 1" });
    await expect(canvas).toBeVisible();
    // The page was really drawn: the canvas has pixels and not all of them are white.
    await expect
      .poll(() =>
        canvas.evaluate((element) => {
          const c = element as HTMLCanvasElement;
          if (c.width === 0) return false;
          const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
          for (let i = 0; i < data.length; i += 4) if (data[i] < 200) return true;
          return false;
        }),
      )
      .toBe(true);
    await expect(page.getByText("Page 1 of 1", { exact: true })).toBeVisible();
    // The details are on the page as well.
    await expect(page.getByText("Details", { exact: true })).toBeVisible();
  });

  test("Download answers with an attachment named after the title, and the bytes are a PDF", async ({ page, request }) => {
    const id = await resourceId("DEMO301", "Sample lecture 1");
    await page.goto(`/resources/${id}`);
    const download = page.getByRole("link", { name: "Download" });
    await expect(download).toHaveAttribute("href", `/api/v1/resources/${id}/download`);

    const response = await request.get(`/api/v1/resources/${id}/download`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["cache-control"]).toBe("no-store");
    const served = await request.get(response.headers()["location"]);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-disposition"]).toBe(`attachment; filename="Sample lecture 1.pdf"; filename*=UTF-8''Sample%20lecture%201.pdf`);
    expect((await served.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  test("Open outside is a plain link to the open route, in a new tab", async ({ page }) => {
    const id = await resourceId("DEMO301", "Sample lecture 1");
    await page.goto(`/resources/${id}`);
    const link = page.getByRole("link", { name: /Open outside/ });
    await expect(link).toHaveAttribute("href", `/api/v1/resources/${id}/open`);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });

  test("a draft and an unknown id show the 404 page", async ({ page }) => {
    const draft = await resourceId("DEMO501", "Sample draft lecture");
    for (const id of [draft, UNKNOWN_ID, "not-a-uuid"]) {
      // The page streams (like the other public pages), so the 404 page replaces the skeleton.
      await page.goto(`/resources/${id}`);
      await expect(page.getByRole("heading", { name: "Page not found" }), id).toBeVisible();
      await expect(page.getByRole("img", { name: /^Page 1 of/ })).toHaveCount(0);
    }
  });

  test("a solution link goes to the solution's reader page", async ({ page }) => {
    const exam = await resourceId("DEMO301", "Sample partial exam 2023");
    const solution = await resourceId("DEMO301", "Sample partial exam 2023 solution");
    await page.goto(`/resources/${exam}`);
    await expect(page.getByRole("img", { name: "Page 1 of 1" })).toBeVisible();
    // The page is reused for the solution: its viewer must load the solution's own file, not keep
    // showing the exam's document.
    const solutionFile = page.waitForRequest((r) => r.url().endsWith(`/api/v1/resources/${solution}/open`));
    await page.getByRole("link", { name: /Solution: Sample partial exam 2023 solution/ }).click();
    await expect(page).toHaveURL(new RegExp(`/resources/${solution}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Sample partial exam 2023 solution" })).toBeVisible();
    await solutionFile;
    await expect(page.getByRole("img", { name: "Page 1 of 1" })).toBeVisible();
    // And back from the solution to its exam.
    await page.getByRole("link", { name: /Solution of: Sample partial exam 2023$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/resources/${exam}$`));
  });

  test("shows a message with the actions when the file cannot be loaded", async ({ page }) => {
    const id = await resourceId("DEMO301", "Sample lecture 1");
    await page.route(`**/api/v1/resources/${id}/open`, (route) => route.fulfill({ status: 500, body: "nope" }));
    await page.goto(`/resources/${id}`);
    await expect(page.getByText("The file could not be shown here.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    // Beside the message (and in the toolbar above the file).
    const alert = page.getByRole("alert");
    await expect(alert.getByRole("link", { name: "Download" })).toBeVisible();
    await expect(alert.getByRole("link", { name: /Open outside/ })).toBeVisible();

    // Once the file is reachable again, Try again shows it.
    await page.unroute(`**/api/v1/resources/${id}/open`);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("img", { name: "Page 1 of 1" })).toBeVisible();
  });

  test.describe("where back leads", () => {
    const cases = [
      { name: "an exam", course: "DEMO301", title: "Sample partial exam 2023", href: "/courses/DEMO301?tab=exams", area: "Previous exams" },
      { name: "a resource of a chapter", course: "DEMO301", title: "Sample lecture 2", href: "/courses/DEMO301/chapters/2", area: "Chapter 2" },
      { name: "material with no chapter in a course with chapters", course: "DEMO501", title: "Sample notes", href: "/courses/DEMO501?tab=other", area: "Other material" },
      { name: "a resource of a course without chapters", course: "DEMO401", title: "Sample lecture 1", href: "/courses/DEMO401", area: null },
    ];
    for (const c of cases) {
      test(`${c.name}: breadcrumb on desktop, back link on phones`, async ({ page, isMobile }) => {
        await page.goto(`/resources/${await resourceId(c.course, c.title)}`);
        if (isMobile) {
          const back = page.getByRole("link", { name: new RegExp(`^Back to ${c.course}`) });
          await expect(back).toHaveAttribute("href", c.href);
          await expect(back).toHaveText(c.course);
        } else {
          const trail = page.getByRole("navigation", { name: "breadcrumb" });
          await expect(trail.getByRole("link", { name: c.course, exact: true })).toHaveAttribute("href", `/courses/${c.course}`);
          if (c.area) await expect(trail.getByRole("link", { name: c.area, exact: true })).toHaveAttribute("href", c.href);
          await expect(trail.getByText(c.title, { exact: true })).toBeVisible();
        }
      });
    }
  });
});

test.describe("GET /api/v1/resources/[id]/download", () => {
  test("answers 404 for a draft, an unknown id and a malformed id, uncached", async ({ request }) => {
    const draft = await resourceId("DEMO501", "Sample draft lecture");
    for (const id of [draft, UNKNOWN_ID, "not-a-uuid"]) {
      const response = await request.get(`/api/v1/resources/${id}/download`, { maxRedirects: 0 });
      expect(response.status(), id).toBe(404);
      expect(response.headers()["cache-control"]).toBe("no-store");
      expect(response.headers()["location"]).toBeUndefined();
    }
  });

  test("sends a browser to the friendly page when it fails", async ({ request }) => {
    for (const id of [UNKNOWN_ID, "not-a-uuid"]) {
      const response = await request.get(`/api/v1/resources/${id}/download`, { maxRedirects: 0, headers: HTML });
      expect(response.status(), id).toBe(307);
      expect(response.headers()["location"]).toBe("/resource-unavailable");
      expect(response.headers()["cache-control"]).toBe("no-store");
    }
  });
});

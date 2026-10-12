import { expect, test } from "@playwright/test";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed
// The demo data has 9 published exams: newest academic year first, then partial, final, second.
const ALL_EXAMS = [
  "Sample partial exam 2025",
  "Sample final exam 2025",
  "Sample partial exam 2024",
  "Sample final exam 2024",
  "Sample second session exam 2024",
  "Sample partial exam 2023",
  "Sample second session exam 2023",
  "Sample partial exam 2022",
  "Sample final exam 2022",
];

// Rows are the list items that open a resource. (Pages visited earlier in the session can stay
// in the DOM hidden, so a plain "ul > li" would also count their lists.)
function rows(page: import("@playwright/test").Page) {
  return page.locator("li").filter({ has: page.locator('a[href$="/open"]') });
}

async function expectTitles(page: import("@playwright/test").Page, titles: string[]) {
  await expect(rows(page)).toHaveCount(titles.length);
  for (const [index, title] of titles.entries()) {
    await expect(rows(page).nth(index)).toContainText(title);
  }
}

// Picking a value submits the form once the page has hydrated; before that the change does
// nothing (Apply still works), so the pick is repeated until the address changes.
async function choose(page: import("@playwright/test").Page, label: string, value: string, url: RegExp) {
  await expect(async () => {
    await page.getByLabel(label).selectOption(value);
    await expect(page).toHaveURL(url, { timeout: 1000 });
  }).toPass();
}

test("the Exams nav item leads to the full list, newest year first", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Exams", exact: true }).click();
  await expect(page).toHaveURL(/\/exams$/);
  await expect(page.getByRole("heading", { name: "Previous exams" })).toBeVisible();
  await expect(page).toHaveTitle(/Previous exams/);
  await expectTitles(page, ALL_EXAMS);
  await expect(page.getByText("9 exams")).toBeVisible();
  // Row: course code and badges for year, session and language.
  await expect(rows(page).first()).toContainText("DEMO401");
  await expect(rows(page).first()).toContainText("2025-2026");
  await expect(rows(page).first()).toContainText("Partial");
  await expect(rows(page).first()).toContainText("EN");
  await expect(rows(page).first().getByRole("link").first()).toHaveAttribute("target", "_blank");
  await expect(rows(page).first().getByRole("link").first()).toHaveAttribute("href", /^\/api\/v1\/resources\/[0-9a-f-]{36}\/open$/);
  // Exams is the current page in the navigation. No pager for a single page.
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Exams" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Next" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Exam pages" })).toHaveCount(0);
});

test("filters by course and session, and the URL carries them", async ({ page }) => {
  await page.goto("/exams");
  await choose(page, "Course", "DEMO301", /\/exams\?course=DEMO301$/);
  await expectTitles(page, ["Sample partial exam 2023", "Sample final exam 2022"]);

  await choose(page, "Session", "final", /\/exams\?course=DEMO301&session=final$/);
  await expectTitles(page, ["Sample final exam 2022"]);

  // The same address, opened directly, shows the same result and the same selections.
  await page.goto("/exams?course=DEMO301&session=final");
  await expectTitles(page, ["Sample final exam 2022"]);
  await expect(page.getByLabel("Course")).toHaveValue("DEMO301");
  await expect(page.getByLabel("Session")).toHaveValue("final");

  // Back goes to the previous filter state, with the dropdowns following.
  await choose(page, "Session", "", /\/exams\?course=DEMO301$/);
  await expect(rows(page)).toHaveCount(2);
  await page.goBack();
  await expect(page).toHaveURL(/session=final$/);
  await expect(page.getByLabel("Session")).toHaveValue("final");
  await expectTitles(page, ["Sample final exam 2022"]);
});

test("filters by semester and academic year", async ({ page }) => {
  await page.goto("/exams?semester=4");
  await expectTitles(page, ["Sample partial exam 2025", "Sample final exam 2024", "Sample partial exam 2022"]);
  await choose(page, "Academic year", "2024", /\/exams\?semester=4&year=2024$/);
  await expectTitles(page, ["Sample final exam 2024"]);
});

test("a semester narrows the course dropdown", async ({ page }) => {
  await page.goto("/exams");
  // Without a semester all courses with an exam are offered, grouped by semester.
  await expect(page.getByLabel("Course").locator("optgroup")).toHaveCount(3);
  await choose(page, "Semester", "4", /\/exams\?semester=4$/);
  const options = page.getByLabel("Course").locator("option");
  await expect(options).toHaveText(["All", "DEMO401 - Sample Course C", "DEMO402 - Sample Course D"]);
});

test("a course that does not fit the semester is dropped from the filters", async ({ page }) => {
  await page.goto("/exams?semester=4&course=DEMO301");
  await expect(page.getByLabel("Course")).toHaveValue("");
  await expect(rows(page)).toHaveCount(3);
});

test("no matches shows the empty state, and Clear filters returns to the full list", async ({ page }) => {
  await page.goto("/exams?semester=3&session=second&year=2022");
  await expect(page.getByText("No exams match these filters.")).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Clear filters" }).last().click();
  await expect(page).toHaveURL(/\/exams$/);
  await expectTitles(page, ALL_EXAMS);
  await expect(page.getByRole("link", { name: "Clear filters" })).toHaveCount(0);
});

test("Clear filters is available whenever a filter is active", async ({ page }) => {
  await page.goto("/exams?year=2024");
  await expect(rows(page)).toHaveCount(3);
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(rows(page)).toHaveCount(9);
});

test("unusable parameters are ignored", async ({ page }) => {
  await page.goto("/exams?year=abc&session=bogus&semester=9&page=0");
  await expect(page.getByRole("heading", { name: "Previous exams" })).toBeVisible();
  await expectTitles(page, ALL_EXAMS);
  // Repeated parameters do not break the page either: the first one counts.
  await page.goto("/exams?year=2024&year=2025");
  await expect(rows(page)).toHaveCount(3);
});

// Only 9 demo exams exist and the page size is fixed at 20, so a real second page cannot be
// reached here. The paging maths and the previous/next links are covered in
// src/app/exams/params.test.ts; this checks the edges that can be reached.
test("paging: no pager for one page, and a page past the end shows the empty state", async ({ page }) => {
  await page.goto("/exams");
  await expect(page.getByRole("link", { name: /^(Go to )?next/i })).toHaveCount(0);
  await page.goto("/exams?page=2");
  await expect(page.getByText("No exams match these filters.")).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await page.goto("/exams?semester=3&page=2");
  await expect(page.getByText("No exams match these filters.")).toBeVisible();
});

test("an exam with a solution shows a Solution link", async ({ page }) => {
  await page.goto("/exams?course=DEMO301");
  const row = rows(page).filter({ hasText: "Sample partial exam 2023" });
  const solution = row.getByRole("link", { name: /^Solution/ });
  await expect(solution).toHaveCount(1);
  await expect(solution).toHaveAttribute("target", "_blank");
  await expect(solution).toHaveAttribute("href", /^\/api\/v1\/resources\/[0-9a-f-]{36}\/open$/);
  await expect(rows(page).filter({ hasText: "Sample final exam 2022" }).getByRole("link", { name: /^Solution/ })).toHaveCount(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("selecting a course and pressing Apply filters the list", async ({ page }) => {
    await page.goto("/exams");
    await expect(rows(page)).toHaveCount(9);
    await page.getByLabel("Course").selectOption("DEMO301");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/\/exams\?.*course=DEMO301/);
    await expectTitles(page, ["Sample partial exam 2023", "Sample final exam 2022"]);
    await expect(page.getByLabel("Course")).toHaveValue("DEMO301");
  });
});

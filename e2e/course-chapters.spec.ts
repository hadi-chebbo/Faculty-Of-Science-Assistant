import { expect, test } from "@playwright/test";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed
test("a course with chapters opens on chapter cards", async ({ page }) => {
  await page.goto("/courses/DEMO301");

  await expect(page.getByRole("link", { name: "Chapters" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("tab")).toHaveCount(0);

  const cards = page.locator("main ul.grid > li");
  await expect(cards).toHaveCount(3);
  for (const [index, title] of ["Sample chapter 1", "Sample chapter 2", "Sample chapter 3"].entries()) {
    const card = cards.nth(index);
    await expect(card).toContainText(`Chapter ${index + 1}`);
    await expect(card).toContainText(title);
    await expect(card.getByRole("link")).toHaveAttribute("href", `/courses/DEMO301/chapters/${index + 1}`);
  }
  // What is inside each chapter.
  await expect(cards.nth(0)).toContainText("1 lecture");
  await expect(cards.nth(1)).toContainText("1 lecture");
  await expect(cards.nth(2)).toContainText("1 note");

  // Rows of other areas are not on this page.
  await expect(page.getByText("Sample partial exam 2023")).toHaveCount(0);
  await expect(page.getByText("Sample exercise sheet 1", { exact: true })).toHaveCount(0);
});

test("the areas switch through the links and the URL", async ({ page }) => {
  await page.goto("/courses/DEMO301");

  await page.getByRole("link", { name: "Previous exams" }).click();
  await expect(page).toHaveURL(/\/courses\/DEMO301\?tab=exams$/);
  await expect(page.getByRole("link", { name: "Previous exams" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Sample partial exam 2023", { exact: true })).toBeVisible();
  await expect(page.getByText("Sample final exam 2022", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "All exams for this course" })).toHaveAttribute("href", "/exams?course=DEMO301");

  await page.getByRole("link", { name: "Other material" }).click();
  await expect(page).toHaveURL(/\/courses\/DEMO301\?tab=other$/);
  await expect(page.getByRole("link", { name: "Other material" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Sample exercise sheet 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Solution/ })).toHaveCount(1);

  await page.getByRole("link", { name: "Chapters" }).click();
  await expect(page).toHaveURL(/\/courses\/DEMO301\??$/);
  await expect(page.getByRole("link", { name: "Chapters" })).toHaveAttribute("aria-current", "page");
});

test("an unknown tab value shows Chapters", async ({ page }) => {
  await page.goto("/courses/DEMO301?tab=nonsense");
  await expect(page.getByRole("link", { name: "Chapters" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Sample chapter 1")).toBeVisible();
});

test("a course without chapters shows the by-type tabs and no area links", async ({ page }) => {
  await page.goto("/courses/DEMO401");
  await expect(page.getByRole("tab", { name: /Lectures/ })).toBeVisible();
  for (const name of ["Chapters", "Previous exams", "Other material"]) {
    await expect(page.getByRole("link", { name })).toHaveCount(0);
  }
});

test("previous exams are grouped by academic year, each row led by its session", async ({ page }) => {
  await page.goto("/courses/DEMO310?tab=exams");

  await expect(page.locator("main h2")).toHaveText(["2025-2026", "2024-2025", "2023-2024", "2022-2023"]);

  // The first block: Final (solved), then Second session, in session order.
  const first = page.locator("main h2").first().locator("xpath=following-sibling::ul[1]/li");
  await expect(first).toHaveCount(2);
  await expect(first.nth(0)).toContainText("Final");
  await expect(first.nth(0)).toContainText("Sample final exam 2025");
  await expect(first.nth(0).getByRole("link", { name: /^Solution/ })).toBeVisible();
  await expect(first.nth(1)).toContainText("Second session");
  await expect(first.nth(1).getByRole("link", { name: /^Solution/ })).toHaveCount(0);

  // The second block holds all three sessions, in order.
  const second = page.locator("main h2").nth(1).locator("xpath=following-sibling::ul[1]/li");
  await expect(second).toHaveCount(3);
  await expect(second.nth(0)).toContainText("Partial");
  await expect(second.nth(1)).toContainText("Final");
  await expect(second.nth(2)).toContainText("Second session");

  // The year and session badges are not repeated in a row: only the language badge is left.
  await expect(first.nth(0).getByText("2025-2026")).toHaveCount(0);

  await expect(page.getByRole("link", { name: "All exams for this course" })).toHaveAttribute(
    "href",
    "/exams?course=DEMO310",
  );
});

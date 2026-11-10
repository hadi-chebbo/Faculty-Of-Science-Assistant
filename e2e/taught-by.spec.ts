import { expect, test } from "@playwright/test";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed
// DEMO510 has files by three fake lecturers (Ada, Alan, Grace) and some with none; DEMO610 has none.
test("a lecturer card narrows the course page and the choice survives areas and chapters", async ({ page }) => {
  await page.goto("/courses/DEMO510");

  const strip = page.getByRole("list", { name: "Lecturer" });
  await expect(page.getByRole("heading", { name: "Taught by" })).toBeVisible();
  await expect(strip.getByRole("link")).toHaveCount(4);
  await expect(strip.getByRole("link", { name: /All lecturers/ })).toHaveAttribute("aria-current", "true");
  await expect(page.getByText(/Showing files by/)).toHaveCount(0);
  const chapters = page.locator("main ul.grid > li");
  await expect(chapters).toHaveCount(6);

  await strip.getByRole("link", { name: /Dr\. Ada Example/ }).click();
  await expect(page).toHaveURL(/\/courses\/DEMO510\?lecturer=ada-example$/);
  await expect(strip.getByRole("link", { name: /Dr\. Ada Example/ })).toHaveAttribute("aria-current", "true");
  await expect(strip.getByRole("link", { name: /All lecturers/ })).not.toHaveAttribute("aria-current", "true");
  await expect(page.getByText("Showing files by Dr. Ada Example only.")).toBeVisible();
  // Ada has no file in chapter 2.
  await expect(chapters).toHaveCount(4);
  await expect(chapters.filter({ hasText: "Chapter 2" })).toHaveCount(0);
  await expect(chapters.first().getByRole("link")).toHaveAttribute("href", "/courses/DEMO510/chapters/1?lecturer=ada-example");

  // Areas keep the lecturer; the cards keep the area.
  await page.getByRole("link", { name: "Previous exams" }).click();
  await expect(page).toHaveURL(/\/courses\/DEMO510\?tab=exams&lecturer=ada-example$/);
  await expect(page.getByText("Sample final exam 2022", { exact: true })).toBeVisible();
  await expect(page.getByText("Sample final exam 2023", { exact: true })).toHaveCount(0);
  await strip.getByRole("link", { name: /Dr\. Alan Sample/ }).click();
  await expect(page).toHaveURL(/\/courses\/DEMO510\?tab=exams&lecturer=alan-sample$/);
  await expect(page.getByText("Sample final exam 2023", { exact: true })).toBeVisible();
  await expect(page.getByText("Sample final exam 2022", { exact: true })).toHaveCount(0);

  // Back restores the previous view.
  await page.goBack();
  await expect(page).toHaveURL(/lecturer=ada-example$/);
  await expect(page.getByText("Showing files by Dr. Ada Example only.")).toBeVisible();

  // Show all drops only the lecturer.
  await page.getByRole("link", { name: "Show all" }).click();
  await expect(page).toHaveURL(/\/courses\/DEMO510\?tab=exams$/);
  await expect(page.getByText(/Showing files by/)).toHaveCount(0);
  await expect(strip.getByRole("link", { name: /All lecturers/ })).toHaveAttribute("aria-current", "true");
});

test("the chapter page counts the strip for the chapter and keeps the lecturer on its links", async ({ page }) => {
  await page.goto("/courses/DEMO510/chapters/3?lecturer=alan-sample");

  const strip = page.getByRole("list", { name: "Lecturer" });
  await expect(strip.getByRole("link", { name: /Dr\. Alan Sample/ })).toHaveAttribute("aria-current", "true");
  await expect(strip.getByRole("link", { name: /All lecturers/ })).toContainText("5 files");
  await expect(page.getByText("Showing files by Dr. Alan Sample only.")).toBeVisible();
  await expect(page.getByText("Sample lecture 3.2", { exact: true })).toBeVisible();
  await expect(page.getByText("Sample lecture 3.1", { exact: true })).toHaveCount(0);

  const nav = page.getByRole("navigation", { name: "Chapters" });
  await expect(nav.getByRole("link", { name: /Previous/ })).toHaveAttribute("href", "/courses/DEMO510/chapters/2?lecturer=alan-sample");
  await expect(nav.getByRole("link", { name: /Next/ })).toHaveAttribute("href", "/courses/DEMO510/chapters/4?lecturer=alan-sample");
  await expect(nav.getByRole("link", { name: "All chapters" })).toHaveAttribute("href", "/courses/DEMO510?lecturer=alan-sample");
  await nav.getByRole("link", { name: /Next/ }).click();
  await expect(page).toHaveURL(/\/chapters\/4\?lecturer=alan-sample$/);

  // Choosing another card on the chapter page changes only the lecturer.
  await strip.getByRole("link", { name: /Pr\. Grace Placeholder/ }).click();
  await expect(page).toHaveURL(/\/chapters\/4\?lecturer=grace-placeholder$/);
});

test("a lecturer with nothing in the chapter gets an empty state and no current card", async ({ page }) => {
  await page.goto("/courses/DEMO510/chapters/2?lecturer=ada-example");

  await expect(page.getByText("No files by Dr. Ada Example in this chapter.")).toBeVisible();
  const strip = page.getByRole("list", { name: "Lecturer" });
  await expect(strip.locator('[aria-current="true"]')).toHaveCount(0);
  await expect(page.getByText("Showing files by Dr. Ada Example only.")).toBeVisible();
  await page.getByRole("link", { name: "Show all files" }).click();
  await expect(page).toHaveURL(/\/courses\/DEMO510\/chapters\/2$/);
  await expect(page.getByText("Sample lecture 2.1", { exact: true })).toBeVisible();
});

test("a link to the reader does not carry the lecturer", async ({ page }) => {
  await page.goto("/courses/DEMO510/chapters/1?lecturer=ada-example");
  const href = await page.getByRole("link", { name: /Sample lecture 1\.3/ }).first().getAttribute("href");
  expect(href).toMatch(/^\/resources\/[0-9a-f-]+$/);
});

test("a course with no lecturers shows no strip", async ({ page }) => {
  await page.goto("/courses/DEMO610");
  await expect(page.getByRole("link", { name: "Chapters" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Lecturer" })).toHaveCount(0);
  await expect(page.getByText("Taught by")).toHaveCount(0);
  // An unknown lecturer is ignored.
  await page.goto("/courses/DEMO510?lecturer=nobody");
  await expect(page.getByText(/Showing files by/)).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Lecturer" }).getByRole("link", { name: /All lecturers/ })).toHaveAttribute("aria-current", "true");
});

test("on a phone the strip scrolls sideways without widening the page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "phone layout");
  await page.goto("/courses/DEMO510");
  const strip = page.getByRole("list", { name: "Lecturer" });
  await expect(strip.getByRole("link")).toHaveCount(4);
  const list = strip;
  expect(await list.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const box = await strip.getByRole("link").first().boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});

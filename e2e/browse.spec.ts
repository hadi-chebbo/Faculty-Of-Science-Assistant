import { expect, test } from "@playwright/test";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed
test("a visitor browses from home to a semester to a course", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Semester 3/ }).click();
  await expect(page.getByRole("heading", { name: "Semester 3" })).toBeVisible();

  await page.getByRole("link", { name: /DEMO301/ }).click();
  await expect(page.getByRole("heading", { name: "Sample Course A" })).toBeVisible();

  // DEMO301 has chapters: its exams are in the "Previous exams" area.
  await page.getByRole("link", { name: "Previous exams" }).click();
  await expect(page).toHaveURL(/\?tab=exams$/);
  // The home page (still in the DOM after client navigation) has a decorative preview with the same
  // sample text, so these look only at what is visible on the course page.
  await expect(page.getByText("Sample partial exam 2023").locator("visible=true")).toBeVisible();
  await expect(page.getByText("2023-2024").locator("visible=true")).toBeVisible();

  // A course without chapters (DEMO401) shows one tab per resource type. The first tab is
  // selected and lists its resources.
  await page.goto("/courses/DEMO401");
  await expect(page.getByRole("tab", { name: /Lectures/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Sample lecture 1")).toBeVisible();

  await page.getByRole("tab", { name: /Exams/ }).click();
  await expect(page.getByText("Sample final exam 2024")).toBeVisible();
  await expect(page.getByText("2024-2025")).toBeVisible();
});

// Next.js decides the HTTP status before streaming starts. For a value that was not prerendered
// (unknown semester, any course code) the first request streams the not-found page with status
// 200, and a repeat request may be served from the cache as 404. So these tests assert the page,
// not the status.
test("an unknown semester shows the not-found page", async ({ page }) => {
  for (const path of ["/semesters/9", "/semesters/abc"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  }
});

test("an unknown course shows the not-found page", async ({ page }) => {
  await page.goto("/courses/NOPE999");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
});

test("Search is visibly disabled, Exams is a link", async ({ page }) => {
  await page.goto("/");
  // Both the top bar and the bottom bar render the items; only one is visible per device.
  const search = page.locator(`[aria-disabled="true"]:visible`, { hasText: "Search" });
  await expect(search).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Search" })).toHaveCount(0);
  await expect(page.locator(`[aria-disabled="true"]:visible`)).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Exams", exact: true })).toHaveAttribute("href", "/exams");
});

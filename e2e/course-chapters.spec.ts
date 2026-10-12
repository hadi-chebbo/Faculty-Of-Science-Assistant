import { expect, test } from "@playwright/test";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed
test("a course with chapters opens by chapter", async ({ page }) => {
  await page.goto("/courses/DEMO301");

  const chapters = page.locator("details[id^='chapter-']");
  await expect(chapters).toHaveCount(3);
  for (const [index, title] of ["Sample chapter 1", "Sample chapter 2", "Sample chapter 3"].entries()) {
    await expect(chapters.nth(index)).toHaveAttribute("id", `chapter-${index + 1}`);
    await expect(chapters.nth(index).locator("summary")).toContainText(`Chapter ${index + 1}`);
    await expect(chapters.nth(index).locator("summary")).toContainText(title);
    await expect(chapters.nth(index).locator("summary")).toContainText("1 item");
  }

  // Only the first chapter is open.
  await expect(chapters.nth(0)).toHaveAttribute("open", "");
  await expect(chapters.nth(1)).not.toHaveAttribute("open", "");
  await expect(chapters.nth(0).getByText("Sample lecture 1")).toBeVisible();
  await expect(page.getByText("Sample lecture 2")).toBeHidden();

  await chapters.nth(1).locator("summary").click();
  await expect(chapters.nth(1).getByText("Sample lecture 2")).toBeVisible();

  // Material with no chapter, with its solution as a link on the row.
  await expect(page.getByRole("heading", { name: "General", level: 2 })).toBeVisible();
  await expect(page.getByText("Sample exercise sheet 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Solution/ })).toHaveCount(2); // exercise sheet and partial exam

  // Exams.
  await expect(page.getByRole("heading", { name: "Previous exams", level: 2 })).toBeVisible();
  await expect(page.getByText("Sample partial exam 2023", { exact: true })).toBeVisible();
  await expect(page.getByText("Sample final exam 2022", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "All exams for this course" })).toHaveAttribute("href", "/exams?course=DEMO301");
});

test("the switch moves between the chapter view and the tabs", async ({ page }) => {
  await page.goto("/courses/DEMO301");
  await expect(page.getByRole("link", { name: "By chapter" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("tab")).toHaveCount(0);

  await page.getByRole("link", { name: "By type" }).click();
  await expect(page).toHaveURL(/\/courses\/DEMO301\?view=type$/);
  await expect(page.getByRole("link", { name: "By type" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("tab", { name: /Lectures/ })).toBeVisible();
  await expect(page.locator("details")).toHaveCount(0);

  await page.getByRole("link", { name: "By chapter" }).click();
  await expect(page).toHaveURL(/\/courses\/DEMO301$/);
  await expect(page.locator("details[id^='chapter-']")).toHaveCount(3);
});

test("a course without chapters shows the tabs and no switch", async ({ page }) => {
  await page.goto("/courses/DEMO401");
  await expect(page.getByRole("tab", { name: /Lectures/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "By type" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "By chapter" })).toHaveCount(0);
});

test("an unknown view value shows the default view", async ({ page }) => {
  await page.goto("/courses/DEMO301?view=nonsense");
  await expect(page.locator("details[id^='chapter-']")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "By chapter" })).toHaveAttribute("aria-current", "page");
});

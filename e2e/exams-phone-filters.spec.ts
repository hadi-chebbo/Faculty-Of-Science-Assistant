import { expect, test } from "@playwright/test";

// Needs the demo data (see exams.spec.ts). On a phone the five filters fold into one
// "Filters (N)" disclosure; from md up nothing changes.

test("phone: the filters are folded into one control that opens to the five selects", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.goto("/exams");
  const summary = page.locator("summary", { hasText: "Filters" });
  await expect(summary).toHaveText("Filters");
  await expect(page.getByLabel("Semester", { exact: true })).toBeHidden();
  await expect(page.getByText(/^\d+ exams · page 1 of \d+$/)).toBeVisible();

  await summary.click();
  for (const label of ["Semester", "Course", "Academic year", "Session", "Lecturer"]) {
    await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Apply" })).toBeVisible();
});

test("phone: applying filters shows the active count", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.goto("/exams?semester=3&year=2024&bogus=1&session=nope");
  await expect(page.locator("summary", { hasText: "Filters" })).toHaveText("Filters (2)");

  // With JavaScript a change submits at once; the disclosure stays open.
  await page.locator("summary").click();
  await expect(async () => {
    await page.getByLabel("Session", { exact: true }).selectOption("final");
    await expect(page).toHaveURL(/session=final/, { timeout: 1000 });
  }).toPass();
  await expect(page.locator("summary", { hasText: "Filters" })).toHaveText("Filters (3)");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("phone: the control opens and Apply filters the list", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    await page.goto("/exams");
    await expect(page.getByLabel("Session", { exact: true })).toBeHidden();
    await page.locator("summary", { hasText: "Filters" }).click();
    await page.getByLabel("Session", { exact: true }).selectOption("final");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/session=final/);
    await expect(page.locator("summary", { hasText: "Filters" })).toHaveText("Filters (1)");
  });
});

test("desktop: the filters stay visible and there is no Filters control", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout");
  await page.goto("/exams");
  await expect(page.getByLabel("Semester", { exact: true })).toBeVisible();
  await expect(page.locator("summary", { hasText: "Filters" })).toBeHidden();
});

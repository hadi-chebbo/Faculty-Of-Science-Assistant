import { expect, test } from "@playwright/test";

// Needs the demo data: DEMO602 is a fixture course with no files at all (DEMO301 has files).
test("a course with no files is not a link on a year page", async ({ page }) => {
  await page.goto("/years/3");
  await expect(page.getByText("DEMO602")).toBeVisible();
  await expect(page.locator('a[href="/courses/DEMO602"]')).toHaveCount(0);
  const card = page.getByRole("listitem").filter({ hasText: "DEMO602" });
  await expect(card).toContainText("No files yet");
  await page.goto("/years/2");
  await expect(page.locator('a[href="/courses/DEMO301"]')).toHaveCount(1);
});

test("a course with no files is not a link in Search", async ({ page }) => {
  await page.goto("/search?q=DEMO602");
  await expect(page.getByText("DEMO602").first()).toBeVisible();
  await expect(page.locator('a[href="/courses/DEMO602"]')).toHaveCount(0);
  await expect(page.getByText("No files yet")).toBeVisible();
  await page.goto("/search?q=DEMO301");
  await expect(page.locator('a[href="/courses/DEMO301"]')).toHaveCount(1);
});

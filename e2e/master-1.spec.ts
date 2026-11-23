import { expect, test } from "@playwright/test";

// Master 1 is the fourth year: stored semesters 7 and 8, shown as "Master 1", URL slug m1. Another test
// (admin-courses) briefly creates an E2E course in it, so these tests do not require the year to be empty.

test("the Master 1 page shows both semesters", async ({ page }) => {
  await page.goto("/years/m1");
  await expect(page).toHaveTitle(/Master 1/);
  await expect(page.getByRole("heading", { level: 1, name: "Master 1" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Semester 1" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Semester 2" })).toBeVisible();
  // Never the stored number.
  await expect(page.getByRole("main")).not.toContainText(/semester [78]/i);
});

test("/years/4 is the not-found page and the old semester links redirect", async ({ page }) => {
  await page.goto("/years/4");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.goto("/semesters/7");
  await expect(page).toHaveURL(/\/years\/m1#semester-1$/);
  await page.goto("/semesters/8");
  await expect(page).toHaveURL(/\/years\/m1#semester-2$/);
});

test("Home shows a fourth card for Master 1", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator("#years li");
  await expect(cards).toHaveCount(4);
  const master = cards.nth(3);
  await expect(master).toContainText("Master 1");
  await expect(master).toContainText("M1");
  await expect(cards.nth(0)).toContainText("First year");
});

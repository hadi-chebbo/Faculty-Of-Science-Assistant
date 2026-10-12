import { expect, test } from "@playwright/test";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed
test("the first chapter shows its material and only a Next link", async ({ page }) => {
  await page.goto("/courses/DEMO301/chapters/1");

  await expect(page.getByRole("heading", { name: "Sample chapter 1", level: 1 })).toBeVisible();
  await expect(page.getByText("Sample lecture 1", { exact: true })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Chapters" });
  await expect(nav.getByRole("link", { name: /Previous/ })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: /Next/ })).toContainText("Sample chapter 2");

  await nav.getByRole("link", { name: /Next/ }).click();
  await expect(page).toHaveURL(/\/courses\/DEMO301\/chapters\/2$/);
  await expect(page.getByRole("heading", { name: "Sample chapter 2", level: 1 })).toBeVisible();
});

test("a middle chapter has both Previous and Next", async ({ page }) => {
  await page.goto("/courses/DEMO301/chapters/2");

  const nav = page.getByRole("navigation", { name: "Chapters" });
  await expect(nav.getByRole("link", { name: /Previous/ })).toContainText("Sample chapter 1");
  await expect(nav.getByRole("link", { name: /Next/ })).toContainText("Sample chapter 3");
});

test("All chapters goes back to the course", async ({ page }) => {
  await page.goto("/courses/DEMO301/chapters/1");
  await page.getByRole("link", { name: "All chapters" }).click();
  await expect(page).toHaveURL(/\/courses\/DEMO301$/);
});

test("an unknown chapter or course shows the not-found page", async ({ page }) => {
  for (const path of ["/courses/DEMO301/chapters/99", "/courses/DEMO401/chapters/1"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  }
});

import { expect, test } from "@playwright/test";

const LINKS = ["Browse", "Exams", "Search", "Saved", "To-do", "Progress"];

test("phone: the hamburger opens the sidebar with two groups and the six links in order", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.goto("/exams");
  const burger = page.getByRole("button", { name: "Open menu" });
  const box = (await burger.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  // The old bottom tab bar is gone and nothing is open yet.
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);

  await expect(async () => {
    await burger.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link", { name: "University Assistant" })).toBeVisible();
  const nav = dialog.getByRole("navigation", { name: "Main" });
  await expect(nav.getByText("Study", { exact: true })).toBeVisible();
  await expect(nav.getByText("Your pages", { exact: true })).toBeVisible();
  await expect(nav.getByRole("link")).toHaveText(LINKS);
  await expect(nav.getByRole("link", { name: "Exams" })).toHaveAttribute("aria-current", "page");
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
});

test("phone: Esc, the close button and the backdrop close it and focus returns to the hamburger", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.goto("/");
  const burger = page.getByRole("button", { name: "Open menu" });
  const open = async () => {
    await expect(async () => {
      if (!(await page.getByRole("dialog").isVisible())) await burger.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
    }).toPass();
  };

  await open();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(burger).toBeFocused();

  await open();
  await page.getByRole("button", { name: "Close menu" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(burger).toBeFocused();

  await open();
  // The backdrop is the strip right of the 280px sidebar.
  await page.locator('[data-slot="sheet-overlay"]').click({ position: { x: page.viewportSize()!.width - 20, y: 300 } });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(burger).toBeFocused();
});

test("phone: tapping an item navigates and closes the sidebar", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.goto("/");
  await expect(async () => {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByRole("dialog").getByRole("link", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("desktop: there is no hamburger, the top bar holds the navigation", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link")).toHaveText(LINKS);
});

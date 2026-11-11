import { expect, type Locator, type Page } from "@playwright/test";

// The "Main" navigation: inline in the desktop top bar, in the sidebar on a phone (the hamburger opens it).
// Returns the visible nav, opening the sidebar first when the hamburger is shown. Retries the tap because
// it does nothing before the page has hydrated.
export async function mainNav(page: Page): Promise<Locator> {
  const burger = page.getByRole("button", { name: "Open menu" });
  const nav = page.getByRole("navigation", { name: "Main" });
  if (await burger.isVisible()) {
    await expect(async () => {
      if (!(await nav.isVisible())) await burger.click();
      await expect(nav).toBeVisible({ timeout: 1000 });
    }).toPass();
  }
  await expect(nav).toBeVisible();
  return nav;
}

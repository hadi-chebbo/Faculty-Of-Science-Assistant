import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

// The account pages have their own layout (slim bar, no site navigation); site pages keep the full chrome.
const DISCLAIMER =
  "Independent student project. Not an official Lebanese University website.";

for (const path of [
  "/sign-in",
  "/sign-up",
  "/sign-up/check-email",
  "/confirm-email",
]) {
  test(`${path} uses the slim account layout`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.locator('nav[aria-label="Main"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /account/i })).toHaveCount(0);
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Sign in" }),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("banner")
        .getByRole("link", { name: "University Assistant" }),
    ).toHaveAttribute("href", "/");
    await expect(
      page.getByRole("banner").getByRole("button", { name: /theme/i }),
    ).toBeVisible();
    await expect(page.getByText(DISCLAIMER)).toBeVisible();
  });
}

test("a site page keeps the full navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('nav[aria-label="Main"]')).toHaveCount(2);
});

for (const path of ["/does-not-exist", `/resources/${randomUUID()}`]) {
  test(`${path.replace(/[0-9a-f-]{36}/, "<uuid>")} shows Page not found with the header once`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(1);
    // Two Main navs are expected: the top one (desktop) and the bottom tab bar (phone); never four.
    await expect(page.locator('nav[aria-label="Main"]')).toHaveCount(2);
  });
}

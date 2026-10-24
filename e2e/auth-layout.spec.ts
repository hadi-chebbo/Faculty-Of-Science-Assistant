import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

// The account pages are full-screen (no site header, navigation or footer); site pages keep the full chrome.
const DISCLAIMER =
  "Independent student project. Not an official Lebanese University website.";

for (const path of [
  "/sign-in",
  "/sign-up",
  "/sign-up/check-email",
  "/confirm-email",
]) {
  test(`${path} is a full-screen account page`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.locator('nav[aria-label="Main"]')).toHaveCount(0);
    await expect(
      page.getByRole("banner").getByRole("button", { name: /account/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Sign in" }),
    ).toHaveCount(0);
    // The brand links home: in the panel on desktop, in the bar on a phone.
    await expect(
      page.getByRole("link", { name: "University Assistant" }).filter({ visible: true }),
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

for (const { path, label } of [
  { path: "/does-not-exist", label: "an unmatched URL" },
  { path: `/resources/${randomUUID()}`, label: "notFound() from a site page" },
]) {
  test(`${label} shows Page not found with the header once`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(1);
    // Two Main navs are expected: the top one (desktop) and the bottom tab bar (phone); never four.
    await expect(page.locator('nav[aria-label="Main"]')).toHaveCount(2);
  });
}

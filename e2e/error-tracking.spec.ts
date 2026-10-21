import { expect, test } from "@playwright/test";

// The test server runs without SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN, so error tracking must be
// completely inert: no request to the tunnel route or to Sentry.
test("home page sends nothing to Sentry when no DSN is set", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Every course, chapter and past exam in one place." })).toBeVisible();
  // The browser SDK would load when the page is idle (a few seconds at most), so give it that long.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(5000);
  expect(urls.filter((url) => /\/monitoring|sentry\.io/.test(url))).toEqual([]);
});

import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Every course, chapter and past exam in one place." })).toBeVisible();
});

test("health endpoint reports the database is reachable", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "up" });
});

test("the site has link-preview and theme-colour tags", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "University Assistant");
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute("content", "light dark");
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", /icon|favicon/);
});

test("the link-preview image and the icons are served", async ({ page, request }) => {
  await page.goto("/");
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  const image = await request.get(new URL(og!).pathname);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  expect((await request.get("/favicon.ico")).status()).toBe(200);
  expect((await request.get("/icon.svg")).status()).toBe(200);
});

test("Skip to content is the first Tab stop and moves focus to the main content", async ({ page }) => {
  await page.goto("/exams");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});

test("every site page has one main landmark with the skip target", async ({ page }) => {
  for (const path of ["/", "/exams", "/search", "/years/2", "/courses/DEMO301", "/courses/DEMO301/chapters/1", "/no-such-page"]) {
    await page.goto(path);
    await expect(page.locator("main#main"), path).toHaveCount(1);
  }
});

test("the 404 page offers home, browse courses and search", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  await expect(main.getByRole("link", { name: "Browse courses" })).toHaveAttribute("href", "/#years");
  await expect(main.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
});

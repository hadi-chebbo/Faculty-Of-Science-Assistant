import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { mainNav } from "./nav-helpers";

// Signed-out visitors: the in-page state on Saved, To-do and Progress, the "why you're here" line on
// /sign-in and a renewable session never seeing the prompt. The demo student comes from the demo seed.
const DEMO_EMAIL = "demo.student@example.com";
const PASSWORD = "demo-student-password";

// Each test gets its own client address so the sign-in rate limit cannot couple tests.
async function ownAddress(page: Page) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
}

const PAGES = [
  { path: "/saved", title: "Sign in to see your saved files", nav: "Saved" },
  { path: "/todo", title: "Sign in to use your to-do board", nav: "To-do" },
  { path: "/progress", title: "Sign in to see your progress", nav: "Progress" },
];

for (const { path, title, nav } of PAGES) {
  test(`${path} signed out: the prompt sits inside the site chrome and nav, with no redirect`, async ({ page }) => {
    await ownAddress(page);
    const response = await page.goto(path);
    await expect(page).toHaveURL(path);
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute(
      "href",
      `/sign-in?next=${encodeURIComponent(path)}`,
    );
    await expect(page.getByRole("main").getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/sign-up");
    await expect(page.getByRole("main").getByRole("link", { name: "Browse courses" })).toHaveAttribute("href", "/");
    // The header and the navigation are still there and the item is current (no lock, no redirect).
    await expect(page.getByRole("banner")).toBeVisible();
    const items = await mainNav(page);
    await expect(items.getByRole("link", { name: nav, exact: true })).toHaveAttribute("aria-current", "page");
  });
}

test("the sidebar still navigates from a prompt on a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await ownAddress(page);
  await page.goto("/saved");
  await (await mainNav(page)).getByRole("link", { name: "To-do", exact: true }).click();
  await expect(page).toHaveURL("/todo");
  await expect(page.getByRole("heading", { level: 2, name: "Sign in to use your to-do board" })).toBeVisible();
});

test("/sign-in names why the visitor is there for a private page, and says nothing otherwise", async ({ page }) => {
  await page.goto("/sign-in?next=%2Ftodo");
  await expect(page.getByTestId("sign-in-reason")).toHaveText("Sign in to use your to-do board");
  await expect(page.getByRole("link", { name: "Back to courses" })).toBeVisible();
  await page.goto("/sign-in?next=%2Fcourses%2FDEMO301");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByTestId("sign-in-reason")).toHaveCount(0);
  await page.goto("/sign-in");
  await expect(page.getByTestId("sign-in-reason")).toHaveCount(0);
});

test("a student whose access token expired is renewed in place and never sees the prompt", async ({ page }) => {
  await ownAddress(page);
  await page.goto("/sign-in?next=%2Fprogress");
  await page.getByLabel("Email").fill(DEMO_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/progress");

  await page.context().clearCookies({ name: "ua_access" });
  await page.goto("/progress");
  await expect(page.getByRole("heading", { level: 1, name: "Your progress" })).toBeVisible();
  await expect(page.getByTestId("signed-out-state")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Sign in to see your progress" })).toHaveCount(0);
  await expect(page).toHaveURL("/progress");
});

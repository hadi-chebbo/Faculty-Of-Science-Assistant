import { expect, test } from "@playwright/test";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed (courses in all four semesters).
// Read-only: it only visits pages.

test("the headline and the two buttons", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Every course, chapter and past exam in one place.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Previous exams" }).first()).toHaveAttribute("href", "/exams");
});

test("Browse courses jumps to the semesters section", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Browse courses" }).click();
  await expect(page).toHaveURL(/#semesters$/);
  await expect(page.getByRole("heading", { name: "Choose your semester" })).toBeInViewport();
});

test("the numbers strip shows four labels with numbers", async ({ page }) => {
  await page.goto("/");
  for (const label of ["Courses", "Chapters", "Files to study from", "Previous exams"]) {
    const value = page.locator("dl div").filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) }).locator("dd");
    await expect(value).toBeVisible();
    expect(Number(await value.innerText())).toBeGreaterThan(0);
  }
});

test("four semester cards, S3 links to its page and shows counts", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator("#semesters li");
  await expect(cards).toHaveCount(4);
  const s3 = page.locator("#semesters").getByRole("link", { name: /S3/ });
  await expect(s3).toHaveAttribute("href", "/semesters/3");
  await expect(s3).toContainText("Autumn");
  await expect(s3).toContainText("Semester 3");
  await expect(s3).toContainText(/\d+ courses? · \d+ files?/);
  await expect(s3).toContainText("Open");
});

test("the steps, the features and the sections", async ({ page }) => {
  await page.goto("/");
  const steps = page.getByRole("list").filter({ has: page.getByRole("heading", { name: "Pick your semester" }) });
  await expect(steps.locator("> li")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Open a course" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Study, or go straight to exams" })).toBeVisible();
  for (const title of [
    "Courses split into chapters",
    "Previous exams by year",
    "Exercises with their solutions",
    "Built for a phone and a slow connection",
  ]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
});

test("each session link opens the exams page with that session selected", async ({ page }) => {
  for (const [name, value] of [
    ["Partial exams", "partial"],
    ["Final exams", "final"],
    ["Second session", "second"],
  ] as const) {
    await page.goto("/");
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/exams\\?session=${value}$`));
    await expect(page.getByLabel("Session")).toHaveValue(value);
  }
});

test("the first question is open and another opens on click", async ({ page }) => {
  await page.goto("/");
  const first = page.locator("details", { hasText: "Is this an official university website?" });
  const second = page.locator("details", { hasText: "Do I need an account?" });
  await expect(first).toHaveAttribute("open", "");
  await expect(second).not.toHaveAttribute("open", "");
  await second.locator("summary").click();
  await expect(second).toHaveAttribute("open", "");
  await expect(second.getByText("Browsing, opening and downloading files never require an account.")).toBeVisible();
});

test("the page makes no claim about features that do not exist", async ({ page }) => {
  await page.goto("/");
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/\bAI\b/);
  expect(text.toLowerCase()).not.toContain("sign up");
  expect(text).not.toContain("Search");
});

test("nothing scrolls sideways", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#semesters li").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

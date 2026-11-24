import { expect, test } from "@playwright/test";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed (courses in all six semesters).
// Read-only: it only visits pages.

test("the headline and the two buttons", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Every course, chapter and past exam in one place.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Previous exams" }).first()).toHaveAttribute("href", "/exams");
});

test("Browse courses jumps to the years section", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Browse courses" }).click();
  await expect(page).toHaveURL(/#years$/);
  await expect(page.getByRole("heading", { name: "Choose your year" })).toBeInViewport();
});

test("the numbers strip shows four labels with numbers", async ({ page }) => {
  await page.goto("/");
  for (const label of ["Courses", "Chapters", "Files to study from", "Previous exams"]) {
    const value = page.locator("dl div").filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) }).locator("dd");
    await expect(value).toBeVisible();
    expect(Number(await value.innerText())).toBeGreaterThan(0);
  }
});

test("four year cards, the second links to its page and shows counts", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#years li")).toHaveCount(4);
  const second = page.locator("#years").getByRole("link", { name: /Second year/ });
  await expect(second).toHaveAttribute("href", "/years/2");
  await expect(second).toContainText("DEMO301");
  await expect(second).toContainText(/\d+ courses? · \d+ files?/);
  await expect(second).toContainText("Browse");
  await expect(page.locator("#years")).not.toContainText(/semester/i);
});

test("the steps, the features and the sections", async ({ page }) => {
  await page.goto("/");
  const steps = page.getByRole("list").filter({ has: page.getByRole("heading", { name: "Pick your year" }) });
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
    await expect(page.locator('input[name="session"]')).toHaveValue(value);
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
  await expect(page.locator("#years li").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the course preview is a generic example with no course code", async ({ page }) => {
  await page.goto("/");
  const preview = page.getByTestId("course-preview");
  await expect(preview).toContainText("Your course");
  await expect(preview).toContainText("Chapter 1: Introduction");
  await expect(preview).toContainText("Final exam 2024-2025");
  await expect(preview).not.toContainText("DEMO");
});

test("on a phone the preview's tab labels are not cut off", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.goto("/");
  for (const name of ["Chapters", "Previous exams"]) {
    const tab = page.getByTestId("course-preview").getByText(name, { exact: true });
    expect(await tab.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
});

test("the account answer says which pages need an account", async ({ page }) => {
  await page.goto("/");
  const answer = page.locator("details", { hasText: "Do I need an account?" });
  await answer.locator("summary").click();
  await expect(answer.getByText("Saved, To-do and Progress need a free account")).toBeVisible();
});

// Document-relative top of an element (stable while scrolling).
async function top(locator: import("@playwright/test").Locator): Promise<number> {
  return locator.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
}

test("on a phone a visitor sees the headline, the years, the preview, then the numbers strip", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.goto("/");
  await expect(page.locator("#years li").first()).toBeVisible();
  const headline = await top(page.getByRole("heading", { level: 1 }));
  const years = await top(page.getByRole("heading", { name: "Choose your year" }));
  const preview = await top(page.getByTestId("course-preview"));
  const strip = await top(page.locator("dl").first());
  expect(headline).toBeLessThan(years);
  expect(years).toBeLessThan(preview);
  expect(preview).toBeLessThan(strip);
  await expect(page.getByText("Stop digging through Drive links.")).toBeVisible();
  // No second copy of anything: one headline, one years heading.
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Choose your year" })).toHaveCount(1);
});

test("on a phone the band slot takes no space for a visitor", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.goto("/");
  await expect(page.locator("#years li").first()).toBeVisible();
  const box = await page.getByTestId("home-band-slot").boundingBox();
  expect(box).toBeNull();
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-signed-in"))).toBe(false);
});

test("on desktop a visitor sees the hero card, then the strip, then the years", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout");
  await page.goto("/");
  await expect(page.locator("#years li").first()).toBeVisible();
  const hero = await top(page.getByRole("heading", { level: 1 }));
  const strip = await top(page.locator("dl").first());
  const years = await top(page.getByRole("heading", { name: "Choose your year" }));
  expect(hero).toBeLessThan(strip);
  expect(strip).toBeLessThan(years);
  // The preview sits beside the intro, not below it.
  const preview = await page.getByTestId("course-preview").boundingBox();
  const headline = await page.getByRole("heading", { level: 1 }).boundingBox();
  expect(preview!.x).toBeGreaterThan(headline!.x + headline!.width - 1);
});

test("a stale hint cookie falls back to the visitor layout with no empty gap", async ({ page, context, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await context.addCookies([{ name: "ua_signed_in", value: "1", url: "http://localhost:" + (process.env.PLAYWRIGHT_PORT ?? 3100) }]);
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-signed-in", /.*/);
  await expect(page.getByText("Stop digging through Drive links.")).toBeVisible();
  await expect(page.getByTestId("course-preview")).toBeVisible();
  expect(await page.getByTestId("home-band-slot").boundingBox()).toBeNull();
  const headline = await top(page.getByRole("heading", { level: 1 }));
  expect(headline).toBeLessThan(300);
});

test("the pre-paint script marks the document from the hint and the stored band height", async ({ page, context, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  const url = "http://localhost:" + (process.env.PLAYWRIGHT_PORT ?? 3100);
  // Hold the session check so only the script has run when we look.
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/v1/auth/me", async (route) => {
    await held;
    await route.continue();
  });
  const marked = () =>
    page.evaluate(() => ({
      signedIn: document.documentElement.dataset.signedIn ?? null,
      band: document.documentElement.style.getPropertyValue("--home-band-h"),
      slot: document.querySelector<HTMLElement>("[data-testid=home-band-slot]")!.getBoundingClientRect().height,
    }));

  // No hint: nothing is marked, whatever is stored.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("home:band-h", "300"));
  await page.reload({ waitUntil: "domcontentloaded" });
  expect(await marked()).toEqual({ signedIn: null, band: "", slot: 0 });

  // Hint plus a sane stored height: marked, and the slot reserves that height.
  await context.addCookies([{ name: "ua_signed_in", value: "1", url }]);
  await page.reload({ waitUntil: "domcontentloaded" });
  expect(await marked()).toEqual({ signedIn: "1", band: "300px", slot: 300 });

  // A silly stored height is ignored (the CSS default applies).
  for (const value of ["5", "99999", "abc", "300px"]) {
    await page.evaluate((v) => localStorage.setItem("home:band-h", v), value);
    await page.reload({ waitUntil: "domcontentloaded" });
    const state = await marked();
    expect(state.signedIn).toBe("1");
    expect(state.band).toBe("");
  }

  // A hint of 0 is no hint.
  await context.addCookies([{ name: "ua_signed_in", value: "0", url }]);
  await page.reload({ waitUntil: "domcontentloaded" });
  expect((await marked()).signedIn).toBeNull();
  release();
});

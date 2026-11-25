import { expect, test, type Page } from "@playwright/test";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed (courses in all six semesters).
// Read-only: it only visits pages.

test("the headline and the two buttons", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find any course, exam or lecture.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Previous exams" }).first()).toHaveAttribute("href", "/exams");
  await expect(page.getByRole("link", { name: "Choose your year" }).first()).toHaveAttribute("href", "#years");
});

test("Choose your year jumps to the years section", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Choose your year" }).first().click();
  await expect(page).toHaveURL(/#years$/);
  await expect(page.getByRole("heading", { name: "Choose your year" })).toBeInViewport();
});

test("typing in the hero search keeps the page; Enter opens the search page with the query", async ({ page }) => {
  await page.goto("/");
  const field = page.getByRole("searchbox", { name: /Search courses, chapters and files/ });
  await field.click();
  await field.fill("algo");
  await expect(page).toHaveURL(/\/$/);
  await expect(field).toHaveValue("algo");
  await field.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=algo$/);
  await expect(page).toHaveTitle(/algo/);
});

test("the Search button opens the search page with the query", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: /Search courses/ }).fill("final exam 2025");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=final(\+|%20)exam(\+|%20)2025$/);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the hero search is a plain form that opens the search page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: /Search courses/ }).fill("graphs");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/\/search\?q=graphs$/);
  });
});

test("the rotating hint shows only while the field is empty", async ({ page }) => {
  await page.goto("/");
  const field = page.getByRole("searchbox", { name: /Search courses/ });
  const hint = page.locator(".hint-cycle");
  await expect(hint).toBeVisible();
  await field.fill("x");
  await expect(hint).toHaveCount(0);
  await field.fill("");
  await expect(hint).toBeVisible();
  // The hint is decoration: it is hidden from assistive technology.
  await expect(hint).toHaveAttribute("aria-hidden", "true");
});

test("four year cards, the second links to its page and shows counts", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#years li")).toHaveCount(4);
  const second = page.locator("#years").getByRole("link", { name: /Second year/ });
  await expect(second).toHaveAttribute("href", "/years/2");
  await expect(second).toContainText("DEMO301");
  await expect(second).toContainText(/\d+ courses? · \d+ files?/);
  await expect(second).toContainText("Open");
  await expect(page.locator("#years")).not.toContainText(/semester/i);
  for (const [name, href] of [["First year", "/years/1"], ["Third year", "/years/3"]] as const) {
    await expect(page.locator("#years").getByRole("link", { name: new RegExp(name) })).toHaveAttribute("href", href);
  }
});

test("Master 1 is a muted card that is not a link until it has courses", async ({ page }) => {
  await page.goto("/");
  const master = page.locator("#years li").nth(3);
  await expect(master).toContainText("Master 1");
  if ((await master.innerText()).includes("No courses yet")) {
    // The demo data has no Master 1 courses: the card says so and is not clickable.
    await expect(master.getByRole("link")).toHaveCount(0);
  } else {
    await expect(master.getByRole("link")).toHaveAttribute("href", "/years/m1");
  }
});

test("the long text sections and the decorative preview are gone, the footer statement stays", async ({ page }) => {
  await page.goto("/");
  for (const name of ["How it works", "What you will find", "Exams coming up?", "Pick your year"]) {
    await expect(page.getByRole("heading", { name })).toHaveCount(0);
  }
  await expect(page.locator("details")).toHaveCount(0);
  await expect(page.getByTestId("course-preview")).toHaveCount(0);
  await expect(page.getByText("Independent student project. Not an official Lebanese University website.")).toBeVisible();
});

test("the page makes no claim about features that do not exist", async ({ page }) => {
  await page.goto("/");
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/\bAI\b/);
  expect(text.toLowerCase()).not.toContain("sign up");
});

test("nothing scrolls sideways", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#years li").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("on a phone every control of the hero and the year cards is at least 44px tall, with text of 12px or more", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#years li").first()).toBeVisible();
  const small = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>("main a, main button, main input").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height < 43.5) out.push(`${el.innerText || el.getAttribute("aria-label") || el.tagName} ${Math.round(r.height)}`);
    });
    document.querySelectorAll<HTMLElement>("main *").forEach((el) => {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
      if (own && parseFloat(getComputedStyle(el).fontSize) < 12) out.push(`tiny: ${(el.textContent ?? "").slice(0, 20)}`);
    });
    return out;
  });
  expect(small).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

// Document-relative top of an element (stable while scrolling).
async function top(locator: import("@playwright/test").Locator): Promise<number> {
  return locator.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
}

test("a visitor sees the headline, then the years", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#years li").first()).toBeVisible();
  const headline = await top(page.getByRole("heading", { level: 1 }));
  const years = await top(page.getByRole("heading", { name: "Choose your year" }));
  expect(headline).toBeLessThan(years);
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

test("a stale hint cookie falls back to the visitor layout with no empty gap", async ({ page, context, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await context.addCookies([{ name: "ua_signed_in", value: "1", url: "http://localhost:" + (process.env.PLAYWRIGHT_PORT ?? 3100) }]);
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-signed-in", /.*/);
  await expect(page.getByRole("searchbox", { name: /Search courses/ })).toBeVisible();
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

// The numbers row under the year cards: live counts of published material, replacing the course browser.
test.describe("the numbers row", () => {
  const numbers = (page: Page) => page.getByRole("region", { name: "In numbers" });

  test("shows files, courses, previous exams and the exam years, after the year cards", async ({ page }) => {
    await page.goto("/");
    const tiles = numbers(page).getByRole("listitem");
    await expect(tiles).toHaveCount(4);
    await expect(tiles.nth(0)).toHaveText(/^[\d,]+\s*files?$/);
    await expect(tiles.nth(1)).toHaveText(/^[\d,]+\s*courses?$/);
    await expect(tiles.nth(2)).toHaveText(/^[\d,]+\s*previous exams?$/);
    await expect(tiles.nth(3)).toHaveText(/^(\d{4})–(\d{4})\s*exam years? covered$/);
    await expect(numbers(page).getByRole("link")).toHaveCount(0);
    expect(await top(page.getByRole("heading", { name: "Choose your year" }))).toBeLessThan(await top(numbers(page)));
  });

  test("the course browser is gone", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Jump straight to a course" })).toHaveCount(0);
    await expect(page.locator("main").getByRole("tablist")).toHaveCount(0);
  });

  test("on a phone the tiles sit two by two, nothing scrolls sideways", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const tiles = numbers(page).getByRole("listitem");
    await expect(tiles).toHaveCount(4);
    // Layout positions (offsetTop ignores the rise-in transform, which staggers the tiles while they appear).
    const tops = await tiles.evaluateAll((items) => items.map((el) => ({ top: (el as HTMLElement).offsetTop, height: (el as HTMLElement).offsetHeight })));
    expect(tops[0].top).toBe(tops[1].top);
    expect(tops[2].top).toBe(tops[3].top);
    expect(tops[2].top).toBeGreaterThanOrEqual(tops[0].top + tops[0].height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });

  test("on a phone a visitor sees the hero, the years, then the numbers", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    await page.goto("/");
    const headline = await top(page.getByRole("heading", { level: 1 }));
    const years = await top(page.getByRole("heading", { name: "Choose your year" }));
    expect(headline).toBeLessThan(years);
    expect(years).toBeLessThan(await top(numbers(page)));
  });
});

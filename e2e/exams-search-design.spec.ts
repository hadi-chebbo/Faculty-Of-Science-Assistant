import { expect, test, type Page } from "@playwright/test";

// The Exams and Search pages in the shared design language (#187). Needs the demo data: SEED_DEMO_DATA=true npm run db:seed.

async function phoneProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>("main a, main button").forEach((el) => {
      const r = el.getBoundingClientRect(); // width 1 or less is the phone Search button, visually hidden until focused
      if (r.width > 1 && r.height < 43.5) out.push(`${el.innerText || el.getAttribute("aria-label") || el.tagName} ${Math.round(r.height)}`);
    });
    document.querySelectorAll<HTMLElement>("main *").forEach((el) => {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
      if (own && el.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(el).fontSize) < 12) {
        out.push(`tiny: ${(el.textContent ?? "").slice(0, 20)}`);
      }
    });
    return out;
  });
}

test("on a phone the exams and search pages have no sideways scroll, 44px targets and text of 12px or more", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/exams", "/exams?session=final", "/search?q=demo", "/search?q=demo&show=files", "/search?q=zzzz", "/search"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeAttached();
    await expect(page.getByRole("heading", { level: 1 }).first()).not.toHaveText("Page not found");
    await page.waitForLoadState("networkidle");
    expect(await phoneProblems(page), path).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBe(390);
  }
});

test("with reduced motion nothing animates on the exams and search pages", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/exams", "/search?q=demo"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const animations = await page.evaluate(() =>
      [...document.querySelectorAll("main *")].map((n) => getComputedStyle(n).animationName).filter((name) => name !== "none" && name !== "scroll-fade"), // scroll-fade follows the scroll position, it is not motion over time
    );
    expect(animations, path).toEqual([]);
  }
});

test("a course result's code chip carries its year's tint, and the exams header has the yellow bar", async ({ page }) => {
  await page.goto("/search?q=DEMO301");
  const chip = page
    .locator("main section", { has: page.getByRole("heading", { level: 2, name: /^Courses ·/ }) })
    .getByRole("link")
    .first()
    .locator("span")
    .first();
  await expect(chip).toHaveClass(/bg-violet-500\/15/); // DEMO301 is in the second year
  await page.goto("/exams");
  await expect(page.locator("main header div[aria-hidden]").last()).toHaveClass(/bg-highlight/);
});

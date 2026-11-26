import { expect, test, type Page } from "@playwright/test";

// The course and chapter pages in the shared design language (#186). Needs the demo data: SEED_DEMO_DATA=true npm run db:seed.

const background = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor);

test("the course header names the year and semester and shows the code in the year's colour", async ({ page, isMobile }) => {
  test.skip(isMobile, "the year line is shown from md up");
  await page.goto("/courses/DEMO301");
  const header = page.locator("main header");
  await expect(header.getByRole("heading", { level: 1 })).toHaveText("DEMO301Sample Course A");
  await expect(header).toContainText("Second year · Semester 1");
  // The current area tab takes the same solid year colour as the year circle in the header.
  const circle = await background(page, "main header p > span[aria-hidden]");
  const tab = await background(page, 'nav[aria-label="Course areas"] a[aria-current="page"]');
  expect(tab).toBe(circle);
  await page.goto("/courses/DEMO301?tab=exams");
  expect(await background(page, 'nav[aria-label="Course areas"] a[aria-current="page"]')).toBe(circle);
});

test("the area tabs say how many items each area holds", async ({ page }) => {
  await page.goto("/courses/DEMO301");
  const tabs = page.getByRole("navigation", { name: "Course areas" });
  await expect(tabs.getByRole("link", { name: /^Chapters \d+$/ })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: /^Previous exams \d+$/ })).toBeVisible();
});

test("the chapter header names the course and chapter above the chapter's title", async ({ page }) => {
  await page.goto("/courses/DEMO302/chapters/1");
  const header = page.locator("main header");
  await expect(header.getByRole("heading", { level: 1, name: "Sample chapter 1" })).toBeVisible();
  await expect(header).toContainText("DEMO302");
  await expect(header).toContainText("· Chapter 1");
});

async function phoneProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>("main a, main button").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height < 43.5) out.push(`${el.innerText || el.getAttribute("aria-label") || el.tagName} ${Math.round(r.height)}`);
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

test("on a phone the course and chapter pages have no sideways scroll, 44px targets and text of 12px or more", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.setViewportSize({ width: 390, height: 844 });
  // Chapters, previous exams and other material of a course with chapters and a "Taught by" strip; a course without
  // chapters (type tabs); a chapter page with jump links, solutions and Previous / Next.
  for (const path of [
    "/courses/DEMO301",
    "/courses/DEMO301?tab=exams",
    "/courses/DEMO510",
    "/courses/DEMO510?tab=other",
    "/courses/DEMO110",
    "/courses/DEMO302/chapters/1",
    "/courses/DEMO301/chapters/2",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Page not found");
    expect(await phoneProblems(page), path).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBe(390);
  }
});

test("with reduced motion the chapter cards do not animate in", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/courses/DEMO301");
  const card = page.locator("main ul.grid > li").first();
  await expect(card).toBeVisible();
  const animations = await card.evaluate((el) =>
    [el, ...el.querySelectorAll("*")].map((n) => getComputedStyle(n).animationName).filter((name) => name !== "none"),
  );
  expect(animations).toEqual([]);
});

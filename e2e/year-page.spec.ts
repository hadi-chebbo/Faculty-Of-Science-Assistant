import { expect, test } from "@playwright/test";

// The year page in the shared design language (#185). Needs the demo data: SEED_DEMO_DATA=true npm run db:seed.

test("each year page leads with its own year circle, as on the home cards", async ({ page }) => {
  for (const [slug, badge, label] of [["1", "1", "First year"], ["2", "2", "Second year"], ["3", "3", "Third year"], ["m1", "M1", "Master 1"]]) {
    await page.goto(`/years/${slug}`);
    const header = page.locator("main header");
    await expect(header.getByRole("heading", { level: 1, name: label })).toBeVisible();
    // The circle is decorative (hidden from assistive technology); the year's name is always beside it.
    await expect(header.getByText(badge, { exact: true })).toBeVisible();
  }
});

test("a course card links to its course and says how many resources it has", async ({ page }) => {
  await page.goto("/years/2");
  const card = page.locator('a[href="/courses/DEMO301"]');
  await expect(card).toContainText("DEMO301");
  await expect(card).toContainText("Sample Course A");
  await expect(card).toContainText(/\d+ resources?/);
  await card.click();
  await expect(page).toHaveURL(/\/courses\/DEMO301$/);
});

test("a semester names how many courses it has", async ({ page }) => {
  await page.goto("/years/2");
  const section = page.getByRole("region", { name: "Semester 1" });
  await expect(section).toContainText(/\d+ courses?/);
});

test("on a phone the year page has no sideways scroll, 44px targets and text of 12px or more", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const slug of ["1", "2", "3", "m1"]) {
    await page.goto(`/years/${slug}`);
    await expect(page.getByRole("heading", { level: 2, name: "Semester 1" })).toBeVisible();
    const small = await page.evaluate(() => {
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
    expect(small, `/years/${slug}`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `/years/${slug}`).toBe(390);
  }
});

test("with reduced motion the course cards do not animate in", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/years/2");
  const card = page.locator('a[href="/courses/DEMO301"]');
  await expect(card).toBeVisible();
  const animations = await card.evaluate((el) => {
    const nodes = [el, ...el.querySelectorAll("*"), el.parentElement!];
    return nodes.map((n) => getComputedStyle(n).animationName).filter((name) => name !== "none");
  });
  expect(animations).toEqual([]);
});

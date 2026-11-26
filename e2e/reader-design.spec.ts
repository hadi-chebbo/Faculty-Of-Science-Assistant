import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { TYPE_STYLES } from "../src/lib/design-language";

// The reader's chrome in the shared design language (#188). Needs the demo data: SEED_DEMO_DATA=true npm run db:seed.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the connection below fails with a clear error.
  }
}

async function resourceId(courseCode: string, title: string): Promise<string> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT r.id FROM resources r JOIN courses c ON c.id = r.course_id WHERE c.code = $1 AND r.title = $2`,
      [courseCode, title],
    );
    expect(rows).toHaveLength(1);
    return rows[0].id;
  } finally {
    await client.end();
  }
}

// Links and buttons of the page (and of an open sheet, which renders in a portal) under 44px, and text under 12px.
async function phoneProblems(page: Page, scope: string): Promise<string[]> {
  return page.evaluate((selector) => {
    const out: string[] = [];
    const roots = [...document.querySelectorAll<HTMLElement>(selector)];
    for (const root of roots) {
      root.querySelectorAll<HTMLElement>("a, button").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 1 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" && r.height < 43.5) {
          out.push(`${el.innerText || el.getAttribute("aria-label") || el.tagName} ${Math.round(r.height)}`);
        }
      });
      root.querySelectorAll<HTMLElement>("*").forEach((el) => {
        if (el.closest(".reader-text")) return; // the PDF's own invisible text, drawn at the file's scale
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
        if (own && el.getBoundingClientRect().width > 1 && parseFloat(getComputedStyle(el).fontSize) < 12) {
          out.push(`tiny: ${(el.textContent ?? "").slice(0, 20)}`);
        }
      });
    }
    return out;
  }, scope);
}

for (const [title, label] of [
  ["Sample lecture 1", "lecture"],
  ["Sample partial exam 2023", "exam"],
] as const) {
  test(`on a phone the reader of a ${label} has no sideways scroll, 44px targets and text of 12px or more`, async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    await page.setViewportSize({ width: 390, height: 844 });
    const id = await resourceId("DEMO301", title);
    const response = await page.goto(`/resources/${id}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Page not found");
    await expect(page.getByRole("img", { name: /^Page 1 of/ })).toBeVisible();
    await page.waitForLoadState("networkidle");

    // The floating bar shows for a few seconds on load; check at once, while it is shown.
    await expect(page.getByRole("group", { name: "Page and zoom" })).toBeVisible();
    expect(await phoneProblems(page, "main"), "bar shown").toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

    await page.getByRole("button", { name: "More actions" }).click();
    await expect(page.getByRole("dialog", { name: "More actions" })).toBeVisible();
    expect(await phoneProblems(page, '[role="dialog"]'), "sheet open").toEqual([]);
    expect(await phoneProblems(page, "main"), "main with the sheet open").toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });
}

test("the reader's chrome does not animate under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const id = await resourceId("DEMO301", "Sample lecture 1");
  await page.goto(`/resources/${id}`);
  await expect(page.getByRole("img", { name: /^Page 1 of/ })).toBeVisible();
  const animations = await page.evaluate(() =>
    [...document.querySelectorAll("main *")].map((n) => getComputedStyle(n).animationName).filter((name) => name !== "none"),
  );
  expect(animations).toEqual([]);
});

test("the type chip beside the title carries the type's colour from the shared design language", async ({ page }) => {
  for (const [title, type, name] of [
    ["Sample lecture 1", "lecture", "Lecture"],
    ["Sample partial exam 2023", "exam", "Exam"],
  ] as const) {
    const id = await resourceId("DEMO301", title);
    await page.goto(`/resources/${id}`);
    const chip = page.locator("main span", { hasText: new RegExp(`^${name}$`) }).first();
    await expect(chip).toHaveClass(new RegExp(TYPE_STYLES[type].chip.split(" ")[0].replace("/", "\\/")));
  }
});

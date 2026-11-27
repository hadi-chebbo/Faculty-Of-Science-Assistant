import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { YEAR_STYLES } from "../src/lib/design-language";

// The Progress page in the shared design language (#189, part B). Needs the demo data: SEED_DEMO_DATA=true npm run db:seed.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the connection below fails with a clear error.
  }
}

const DEMO_EMAIL = "demo.student@example.com";
const PASSWORD = "demo-student-password";

test.describe.configure({ mode: "serial" });

async function signIn(page: Page, email = DEMO_EMAIL) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  await page.goto("/sign-in?next=%2Fprogress");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/progress");
}

async function withDb<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

// Links and buttons of the page under 44px, and text under 12px.
async function phoneProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const main = document.querySelector("main#main")!;
    main.querySelectorAll<HTMLElement>("a, button").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 1 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" && r.height < 43.5) {
        out.push(`${el.innerText || el.getAttribute("aria-label") || el.tagName} ${Math.round(r.height)}`);
      }
    });
    main.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
      if (own && el.getBoundingClientRect().width > 1 && parseFloat(getComputedStyle(el).fontSize) < 12) {
        out.push(`tiny: ${(el.textContent ?? "").slice(0, 20)}`);
      }
    });
    return out;
  });
}

test("on a phone /progress has no sideways scroll, 44px targets and text of 12px or more", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your progress");
  await expect(page.getByRole("list", { name: "Milestones" })).toBeVisible();
  await expect(page.getByRole("main").locator('h2[id^="year-"]').first()).toBeVisible();
  expect(await phoneProblems(page)).toEqual([]);
  // The Milestones row may scroll inside its panel; the page itself may not.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("on a phone the empty /progress state is as tidy", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.setViewportSize({ width: 390, height: 844 });
  const email = "progress-design-empty@example.com";
  await withDb(async (client) => {
    await client.query(`DELETE FROM users WHERE email = $1`, [email]);
    await client.query(
      `INSERT INTO users (email, name, password_hash, role, email_confirmed_at, created_at, updated_at)
       SELECT $1, 'Empty Design', password_hash, 'student', now(), now(), now() FROM users WHERE email = $2`,
      [email, DEMO_EMAIL],
    );
  });
  try {
    await signIn(page, email);
    await expect(page.getByText("Nothing marked as done yet.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your progress");
    expect(await phoneProblems(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  } finally {
    await withDb((client) => client.query(`DELETE FROM users WHERE email = $1`, [email]));
  }
});

test("the year heading wears its year circle and the code chip its year tint", async ({ page }) => {
  await signIn(page);
  const heading = page.locator("#year-3");
  await expect(heading).toHaveText("Third year");
  const circle = heading.locator("xpath=preceding-sibling::span[1]");
  for (const cls of YEAR_STYLES[3].solid.split(" ")) {
    await expect(circle).toHaveClass(new RegExp(`(^|\\s)${cls}(\\s|$)`));
  }
  const chip = page.getByRole("link", { name: "DEMO610 Sample Full Course D" }).locator("span").first();
  await expect(chip).toHaveText("DEMO610");
  await expect(chip).toHaveClass(new RegExp(YEAR_STYLES[3].chip.split(" ")[0].replace("/", "\\/")));
});

test("nothing on /progress animates under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page);
  await expect(page.getByRole("list", { name: "Milestones" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Your progress" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  // main#main is this page's; the sign-in form's own main may still be kept in the DOM, hidden, after the redirect.
  const animations = await page.evaluate(() =>
    [...document.querySelectorAll("main#main *")].map((n) => getComputedStyle(n).animationName).filter((name) => name !== "none"),
  );
  expect(animations).toEqual([]);
});

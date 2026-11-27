import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { TYPE_STYLES } from "../src/lib/design-language";

// The to-do board in the shared design language (#189). Needs the demo data: SEED_DEMO_DATA=true npm run db:seed.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the connection below fails with a clear error.
  }
}

test.describe.configure({ mode: "serial" });

const DEMO_EMAIL = "demo.student@example.com";
const PASSWORD = "demo-student-password";
const emailFor = (isMobile: boolean) => `todo-design-${isMobile ? "phone" : "desktop"}@example.com`;

async function withDb<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

test.beforeEach(async ({ isMobile }) => {
  await withDb(async (client) => {
    await client.query(`DELETE FROM users WHERE email = $1`, [emailFor(isMobile)]);
    await client.query(
      `INSERT INTO users (email, name, password_hash, role, email_confirmed_at, created_at, updated_at)
       SELECT $1, 'Design Tester', password_hash, 'student', now(), now(), now() FROM users WHERE email = $2`,
      [emailFor(isMobile), DEMO_EMAIL],
    );
    // A card linked to a published lecture, a plain note card and a card in progress.
    const { rows } = await client.query(
      `SELECT r.id FROM resources r JOIN courses c ON c.id = r.course_id WHERE c.code = 'DEMO301' AND r.title = 'Sample lecture 1'`,
    );
    const user = (await client.query(`SELECT id FROM users WHERE email = $1`, [emailFor(isMobile)])).rows[0].id;
    await client.query(
      `INSERT INTO todos (user_id, status, position, title, note, resource_id) VALUES
       ($1, 'todo', 0, 'Revise the graph lecture', 'Focus on the proofs.', $2),
       ($1, 'todo', 1, 'Ask about the project deadline', '', NULL),
       ($1, 'in_progress', 0, 'Exercise sheet', '', NULL)`,
      [user, rows[0].id],
    );
  });
});

// Deleting the user removes the cards too.
test.afterEach(async ({ isMobile }) => {
  await withDb((client) => client.query(`DELETE FROM users WHERE email = $1`, [emailFor(isMobile)]));
});

async function signInOnBoard(page: Page, isMobile: boolean) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  await page.goto("/sign-in?next=%2Ftodo");
  await page.getByLabel("Email").fill(emailFor(isMobile));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/todo");
  await expect(page.getByRole("heading", { level: 1, name: "To-do" })).toBeVisible();
}

// Links and buttons under 44px, and text under 12px, inside the scope (a sheet renders in a portal).
async function phoneProblems(page: Page, scope: string): Promise<string[]> {
  return page.evaluate((selector) => {
    const out: string[] = [];
    for (const root of document.querySelectorAll<HTMLElement>(selector)) {
      root.querySelectorAll<HTMLElement>("a, button").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 1 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" && r.height < 43.5) {
          out.push(`${el.innerText || el.getAttribute("aria-label") || el.tagName} ${Math.round(r.height)}`);
        }
      });
      root.querySelectorAll<HTMLElement>("*").forEach((el) => {
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
        if (own && el.getBoundingClientRect().width > 1 && parseFloat(getComputedStyle(el).fontSize) < 12) {
          out.push(`tiny: ${(el.textContent ?? "").slice(0, 20)}`);
        }
      });
    }
    return out;
  }, scope);
}

test("on a phone the board has no sideways scroll, 44px targets and text of 12px or more", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.setViewportSize({ width: 390, height: 844 });
  await signInOnBoard(page, isMobile);
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Page not found");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 3, name: "Revise the graph lecture" })).toBeVisible();
  expect(await phoneProblems(page, "main"), "board and tabs").toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  await page.getByRole("button", { name: "New card" }).click();
  await expect(page.getByRole("textbox", { name: /^New card in/ })).toBeVisible();
  expect(await phoneProblems(page, "main"), "composer open").toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Revise the graph lecture", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(500); // the dialog opens with a zoom-in, which shrinks the boxes a little while it runs
  expect(await phoneProblems(page, '[role="dialog"]'), "card view open").toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test("the board does not animate under reduced motion", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signInOnBoard(page, isMobile);
  await expect(page.getByRole("heading", { level: 3, name: "Revise the graph lecture" }).first()).toBeVisible();
  const animations = await page.evaluate(() =>
    [...document.querySelectorAll("main *")].filter((n) => !n.closest('form[action*="sign-in"], form') && getComputedStyle(n).animationName !== "none")
      .map((n) => n.outerHTML.slice(0, 120)),
  );
  expect(animations).toEqual([]);
});

test("the linked file's icon box carries the lecture colour from the shared design language", async ({ page, isMobile }) => {
  await signInOnBoard(page, isMobile);
  const tile = page.getByRole("link", { name: /^Open Sample lecture 1 in the reader/ }).first();
  await expect(tile).toBeVisible();
  await expect(tile.locator("span").first()).toHaveClass(new RegExp(TYPE_STYLES.lecture.chip.split(" ")[0].replace("/", "\\/")));
});

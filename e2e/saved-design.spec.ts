import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { YEAR_STYLES } from "../src/lib/design-language";

// Saved and the in-page sign-in state in the shared design language (#189, part A).
// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed (with STORAGE_DRIVER=local).
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the connection below fails with a clear error.
  }
}

const DEMO_EMAIL = "demo.student@example.com"; // from the demo seed; its password hash is copied
const PASSWORD = "demo-student-password";

// The two projects (desktop, phone) run at the same time, so each signs in as its own fresh student.
test.describe.configure({ mode: "serial" });

const emailFor = (isMobile: boolean) => `saved-design-${isMobile ? "phone" : "desktop"}@example.com`;

async function withDb<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function resourceId(courseCode: string, title: string): Promise<string> {
  return withDb(async (client) => {
    const { rows } = await client.query(
      `SELECT r.id FROM resources r JOIN courses c ON c.id = r.course_id WHERE c.code = $1 AND r.title = $2`,
      [courseCode, title],
    );
    expect(rows).toHaveLength(1);
    return rows[0].id;
  });
}

test.beforeEach(async ({ isMobile }) => {
  await withDb(async (client) => {
    await client.query(`DELETE FROM users WHERE email = $1`, [emailFor(isMobile)]);
    await client.query(
      `INSERT INTO users (email, name, password_hash, role, email_confirmed_at, created_at, updated_at)
       SELECT $1, 'Design Tester', password_hash, 'student', now(), now(), now() FROM users WHERE email = $2`,
      [emailFor(isMobile), DEMO_EMAIL],
    );
  });
});

test.afterEach(async ({ isMobile }) => {
  await withDb((client) => client.query(`DELETE FROM users WHERE email = $1`, [emailFor(isMobile)]));
});

async function signIn(page: Page, isMobile: boolean, next: string) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  await page.goto("/sign-in?next=" + encodeURIComponent(next));
  await page.getByLabel("Email").fill(emailFor(isMobile));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(next);
}

async function save(page: Page, baseURL: string, code: string, title: string) {
  const response = await page.request.put(`/api/v1/saved/${await resourceId(code, title)}`, { headers: { origin: new URL(baseURL).origin } });
  expect(response.status()).toBe(204);
}

// Links and buttons of main under 44px, and own text under 12px.
async function phoneProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const main = document.querySelector("main")!;
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

async function expectPhoneOk(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  expect(await phoneProblems(page), label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth), `${label}: sideways scroll`).toBe(390);
}

test("on a phone Saved, with items and empty, fits the screen with 44px targets and 12px text", async ({ page, isMobile, baseURL }) => {
  test.skip(!isMobile, "phone layout");
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, isMobile, "/saved");
  await expect(page.getByText("Nothing saved yet.")).toBeVisible();
  await expectPhoneOk(page, "empty");

  await save(page, baseURL!, "DEMO301", "Sample notes");
  await save(page, baseURL!, "DEMO501", "Sample notes");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Saved");
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveCount(2);
  await expectPhoneOk(page, "with items");
});

for (const path of ["/saved", "/todo", "/progress"]) {
  test(`on a phone the signed-out state of ${path} fits the screen`, async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await expect(page.getByTestId("signed-out-state")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Page not found");
    await expectPhoneOk(page, path);
  });
}

test("Saved and the signed-out state do not animate under reduced motion", async ({ page, isMobile, baseURL }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/saved");
  await expect(page.getByTestId("signed-out-state")).toBeVisible();
  const animated = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("main *")].map((n) => getComputedStyle(n).animationName).filter((name) => name !== "none"),
    );
  expect(await animated()).toEqual([]);
  await signIn(page, isMobile, "/saved");
  await save(page, baseURL!, "DEMO301", "Sample notes");
  await page.reload();
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveCount(1);
  expect(await animated()).toEqual([]);
});

test("a course's code chip takes its year's colour from the shared design language", async ({ page, isMobile, baseURL }) => {
  await signIn(page, isMobile, "/saved");
  await save(page, baseURL!, "DEMO301", "Sample notes"); // second year
  await page.reload();
  const chip = page.getByRole("region", { name: /DEMO301/ }).getByRole("link", { name: "DEMO301" });
  await expect(chip).toHaveClass(new RegExp(YEAR_STYLES[2].chip.split(" ")[0].replace("/", "\\/")));
});

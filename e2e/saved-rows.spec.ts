import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

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

// The two projects (desktop, phone) run at the same time, so each signs in as its own fresh student
// and saves its own file (neither is used by the other saved specs); a project's tests run in turn.
test.describe.configure({ mode: "serial" });

// A course without chapters (so its files are listed in tabs) and the "Other" file in it.
const COURSE = { desktop: "DEMO402", mobile: "DEMO601" } as const;
const FILE = {
  desktop: "Sample lab guide",
  mobile: "Sample project brief",
} as const;

async function withDb<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

const emailFor = (isMobile: boolean) =>
  `saved-rows-${isMobile ? "phone" : "desktop"}@example.com`;
const who = (isMobile: boolean) => (isMobile ? "mobile" : "desktop");

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
    await client.query(`DELETE FROM users WHERE email = $1`, [
      emailFor(isMobile),
    ]);
    await client.query(
      `INSERT INTO users (email, name, password_hash, role, email_confirmed_at, created_at, updated_at)
       SELECT $1, 'Rows Tester', password_hash, 'student', now(), now(), now() FROM users WHERE email = $2`,
      [emailFor(isMobile), DEMO_EMAIL],
    );
  });
});

// Deleting the user removes its saves too, so other specs are unaffected.
test.afterEach(async ({ isMobile }) => {
  await withDb((client) =>
    client.query(`DELETE FROM users WHERE email = $1`, [emailFor(isMobile)]),
  );
});

// Each test gets its own client address so the sign-in rate limit cannot couple tests.
async function ownAddress(page: Page) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}`,
  });
}

async function signIn(page: Page, isMobile: boolean) {
  await page.getByLabel("Email").fill(emailFor(isMobile));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const savedCount = (id: string) =>
  withDb(
    async (client) =>
      (
        await client.query(
          `SELECT count(*)::int AS n FROM bookmarks WHERE resource_id = $1`,
          [id],
        )
      ).rows[0].n,
  );

test("a student saves from a course page row, sees it filled after a reload and finds it under Saved", async ({
  page,
  isMobile,
}) => {
  await ownAddress(page);
  const course = COURSE[who(isMobile)];
  const title = FILE[who(isMobile)];
  const id = await resourceId(course, title);
  await page.goto("/sign-in?next=" + encodeURIComponent(`/courses/${course}`));
  await signIn(page, isMobile);
  await expect(page).toHaveURL(`/courses/${course}`);

  await page.getByRole("tab", { name: /^Other/ }).click();
  const save = page.getByRole("button", { name: `Save ${title}` });
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await save.click();
  await expect(
    page.getByText("Saved. Find it under Saved in your account menu."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Remove ${title} from saved` }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await savedCount(id)).toBe(1);

  await page.reload();
  await page.getByRole("tab", { name: /^Other/ }).click();
  await expect(
    page.getByRole("button", { name: `Remove ${title} from saved` }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.goto("/saved");
  await expect(
    page.getByRole("link", { name: new RegExp(title) }),
  ).toHaveAttribute("href", `/resources/${id}`);
  // Exactly one bookmark on the row, filled (the row also has an "Add to to-do" button).
  await expect(page.getByRole("main").getByRole("button", { name: /from saved$|^Save / })).toHaveCount(1);
  await expect(page.getByRole("main").getByRole("button", { name: `Add ${title} to to-do` })).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: `Remove ${title} from saved` }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("a page asks for the saved ids once however many rows it has, and a visitor never asks", async ({
  page,
  isMobile,
}) => {
  await ownAddress(page);
  const idRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/saved/ids")
      idRequests.push(request.url());
  });

  // Signed out: several rows, no request.
  await page.goto("/exams");
  const bookmarks = page.getByRole("button", { name: /^Save / });
  await expect(bookmarks.nth(2)).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(idRequests).toHaveLength(0);

  // Signed in: exactly one.
  await page.goto("/sign-in?next=%2Fexams");
  await signIn(page, isMobile);
  await expect(page).toHaveURL("/exams");
  await expect(bookmarks.nth(2)).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(idRequests).toHaveLength(1);
});

test("a signed-out click goes to sign-in with the page and its filter, returns there and saves nothing", async ({
  page,
  isMobile,
}) => {
  await ownAddress(page);
  const id = await resourceId("DEMO401", "Sample final exam 2024");
  await page.goto("/exams?course=DEMO401&session=final");
  await page
    .getByRole("button", { name: "Save Sample final exam 2024" })
    .click();
  await expect(page).toHaveURL(
    "/sign-in?next=" +
      encodeURIComponent("/exams?course=DEMO401&session=final"),
  );

  await signIn(page, isMobile);
  await expect(page).toHaveURL("/exams?course=DEMO401&session=final");
  await expect(
    page.getByRole("button", { name: "Save Sample final exam 2024" }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(await savedCount(id)).toBe(0);
});

test("the icon is on chapter pages and search results, outside the row link, and rows still open the reader", async ({
  page,
}) => {
  await page.goto("/courses/DEMO302/chapters/1");
  const row = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: /Sample lecture 1/ }) });
  await expect(
    row.getByRole("button", { name: "Save Sample lecture 1" }),
  ).toBeVisible();
  expect(await page.locator("a button, button a").count()).toBe(0);

  await page.goto("/search?q=reference");
  const hit = page
    .getByRole("listitem")
    .filter({ hasText: "DEMO302" })
    .filter({
      has: page.getByRole("link", { name: /Sample reference sheet/ }),
    });
  await expect(
    hit.getByRole("button", { name: "Save Sample reference sheet" }),
  ).toBeVisible();
  expect(await page.locator("a button, button a").count()).toBe(0);

  const id = await resourceId("DEMO302", "Sample reference sheet");
  await hit.getByRole("link", { name: /Sample reference sheet/ }).click();
  await expect(page).toHaveURL(`/resources/${id}`);
});

test("on a phone the icon is visible and nothing overflows sideways", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Phone layout");
  for (const path of ["/courses/DEMO402", "/exams", "/search?q=sample"]) {
    await page.goto(path);
    await expect(
      page.getByRole("button", { name: /^Save / }).first(),
    ).toBeVisible();
    const fits = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    );
    expect(fits, path).toBe(true);
  }
});

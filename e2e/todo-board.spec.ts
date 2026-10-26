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

// The two projects (desktop, phone) run at the same time, each as its own fresh student with an
// empty board; the tests of one project run one after the other.
test.describe.configure({ mode: "serial" });

async function withDb<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

const emailFor = (isMobile: boolean) => `todo-board-${isMobile ? "phone" : "desktop"}@example.com`;

test.beforeEach(async ({ isMobile }) => {
  await withDb(async (client) => {
    await client.query(`DELETE FROM users WHERE email = $1`, [emailFor(isMobile)]);
    await client.query(
      `INSERT INTO users (email, name, password_hash, role, email_confirmed_at, created_at, updated_at)
       SELECT $1, 'Board Tester', password_hash, 'student', now(), now(), now() FROM users WHERE email = $2`,
      [emailFor(isMobile), DEMO_EMAIL],
    );
  });
});

// Deleting the user removes the cards too.
test.afterEach(async ({ isMobile }) => {
  await withDb((client) => client.query(`DELETE FROM users WHERE email = $1`, [emailFor(isMobile)]));
});

// Each test gets its own client address so the sign-in rate limit cannot couple tests.
async function ownAddress(page: Page) {
  const octet = () => randomBytes(1)[0];
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
}

async function signInOnBoard(page: Page, isMobile: boolean) {
  await ownAddress(page);
  await page.goto("/sign-in?next=%2Ftodo");
  await page.getByLabel("Email").fill(emailFor(isMobile));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/todo");
  await expect(page.getByRole("heading", { level: 1, name: "To-do" })).toBeVisible();
}

const column = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const cardsIn = (page: Page, name: string) => column(page, name).getByRole("heading", { level: 3 });
const added = (page: Page) => page.waitForResponse((r) => r.url().endsWith("/api/v1/todos") && r.request().method() === "POST");

test("signed out, /todo goes to sign-in and signing in returns to the board", async ({ page, isMobile }) => {
  await ownAddress(page);
  await page.goto("/todo");
  await expect(page).toHaveURL("/sign-in?next=%2Ftodo");
  await page.getByLabel("Email").fill(emailFor(isMobile));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/todo");
  await expect(page.getByRole("heading", { level: 1, name: "To-do" })).toBeVisible();
});

test("the account menu has To-do and it opens the board", async ({ page, isMobile }) => {
  await ownAddress(page);
  await page.goto("/sign-in?next=%2Fsaved");
  await page.getByLabel("Email").fill(emailFor(isMobile));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/saved");
  await page.getByRole("button", { name: "Board Tester" }).click();
  await page.getByRole("menuitem", { name: "To-do" }).click();
  await expect(page).toHaveURL("/todo");
  await expect(page.getByRole("heading", { level: 1, name: "To-do" })).toBeVisible();
});

test("desktop: empty columns, adding cards at the top of their column, N key, and persistence", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout");
  await signInOnBoard(page, isMobile);

  // Empty board: three columns, counts 0, friendly text.
  for (const name of ["To do", "In progress", "Done"]) {
    await expect(column(page, name).getByRole("heading", { level: 2, name })).toBeVisible();
    await expect(column(page, name).getByText("0", { exact: true })).toBeVisible();
  }
  await expect(column(page, "To do").getByText("Nothing planned. Add the next thing you want to study.")).toBeVisible();
  await expect(column(page, "Done").getByText("Finished cards land here. Enjoy it.")).toBeVisible();

  // Add to In progress.
  await column(page, "In progress").getByRole("button", { name: "Add a card", exact: true }).click();
  await page.getByRole("textbox", { name: "New card in In progress" }).fill("Read the routing lecture");
  const first = added(page);
  await page.keyboard.press("Enter");
  await first;
  await expect(cardsIn(page, "In progress")).toHaveText(["Read the routing lecture"]);
  await expect(column(page, "In progress").getByText("1", { exact: true })).toBeVisible();
  await expect(column(page, "In progress").getByText("Added just now")).toBeVisible();
  // An empty title does nothing; Esc closes the form and puts the focus back.
  await page.keyboard.press("Enter");
  await expect(cardsIn(page, "In progress")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("textbox", { name: "New card in In progress" })).toHaveCount(0);
  await expect(column(page, "In progress").getByRole("button", { name: "Add a card", exact: true })).toBeFocused();

  // Two cards in To do: the newest is on top.
  await column(page, "To do").getByRole("button", { name: "Add a card", exact: true }).click();
  const input = page.getByRole("textbox", { name: "New card in To do" });
  await input.fill("Revise chapter 1");
  const second = added(page);
  await input.press("Enter");
  await second;
  await input.fill("Redo exercise 4");
  const third = added(page);
  await input.press("Enter");
  await third;
  await input.press("Escape");
  await expect(cardsIn(page, "To do")).toHaveText(["Redo exercise 4", "Revise chapter 1"]);

  // N opens the To do form when nothing is focused.
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  await page.keyboard.press("n");
  await expect(page.getByRole("textbox", { name: "New card in To do" })).toBeFocused();
  // Typing "n" inside the form is text, not a shortcut.
  await page.keyboard.type("nn");
  await expect(page.getByRole("textbox", { name: "New card in To do" })).toHaveValue("nn");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("textbox", { name: "New card in To do" })).toHaveCount(0);

  // The New card button does the same.
  await page.getByRole("button", { name: /New card/ }).click();
  await expect(page.getByRole("textbox", { name: "New card in To do" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Everything survives a reload, in the same order.
  await page.reload();
  await expect(cardsIn(page, "To do")).toHaveText(["Redo exercise 4", "Revise chapter 1"]);
  await expect(cardsIn(page, "In progress")).toHaveText(["Read the routing lecture"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("phone: tabs with counts, the round + adds to the shown tab and stays clear of the tab bar", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await signInOnBoard(page, isMobile);

  const tab = (name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
  await expect(tab("To do")).toHaveText("To do0");
  await expect(tab("In progress")).toHaveText("In progress0");
  await expect(tab("Done")).toHaveText("Done0");
  await expect(page.getByRole("tabpanel").getByText("Nothing planned. Add the next thing you want to study.")).toBeVisible();
  await expect(page.getByRole("region", { name: "To do" })).toBeHidden();

  // The + button sits above the fixed bottom tab bar, not over it.
  const plus = page.getByRole("button", { name: "New card" });
  const bar = page.getByRole("navigation").filter({ has: page.getByRole("link", { name: "Browse" }) }).last();
  const plusBox = (await plus.boundingBox())!;
  const barBox = (await bar.boundingBox())!;
  expect(plusBox.y + plusBox.height).toBeLessThanOrEqual(barBox.y);
  expect(plusBox.width).toBeGreaterThanOrEqual(44);

  await plus.click();
  await page.getByRole("textbox", { name: "New card in To do" }).fill("Phone card");
  const first = added(page);
  await page.keyboard.press("Enter");
  await first;
  await expect(tab("To do")).toHaveText("To do1");
  await expect(page.getByRole("heading", { level: 3, name: "Phone card" })).toBeVisible();
  await page.keyboard.press("Escape");

  // The + adds to the tab that is shown.
  await tab("In progress").click();
  await expect(page.getByRole("tabpanel").getByText("Nothing in progress. Add a card for what you are working on.")).toBeVisible();
  await plus.click();
  await page.getByRole("textbox", { name: "New card in In progress" }).fill("Second");
  const second = added(page);
  await page.keyboard.press("Enter");
  await second;
  await expect(tab("In progress")).toHaveText("In progress1");
  await expect(page.getByRole("heading", { level: 3, name: "Second" })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.reload();
  await expect(tab("To do")).toHaveText("To do1");
  await expect(tab("In progress")).toHaveText("In progress1");
  await expect(page.getByRole("heading", { level: 3, name: "Phone card" })).toBeVisible();
});

import { randomBytes } from "node:crypto";
import { expect, test, type Page, type Response } from "@playwright/test";
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

const emailFor = (isMobile: boolean) => `todo-card-view-${isMobile ? "phone" : "desktop"}@example.com`;

test.beforeEach(async ({ isMobile }) => {
  await withDb(async (client) => {
    await client.query(`DELETE FROM users WHERE email = $1`, [emailFor(isMobile)]);
    await client.query(
      `INSERT INTO users (email, name, password_hash, role, email_confirmed_at, created_at, updated_at)
       SELECT $1, 'Card Tester', password_hash, 'student', now(), now(), now() FROM users WHERE email = $2`,
      [emailFor(isMobile), DEMO_EMAIL],
    );
  });
});

// Deleting the user removes the cards too.
test.afterEach(async ({ isMobile }) => {
  await withDb((client) => client.query(`DELETE FROM users WHERE email = $1`, [emailFor(isMobile)]));
});

// Cards for the test student, top to bottom within their column.
async function seedCards(isMobile: boolean, cards: { title: string; status?: string; note?: string }[]) {
  await withDb(async (client) => {
    const positions: Record<string, number> = {};
    for (const card of cards) {
      const status = card.status ?? "todo";
      const position = (positions[status] = (positions[status] ?? -1) + 1);
      await client.query(
        `INSERT INTO todos (user_id, status, position, title, note)
         SELECT id, $2, $3, $4, $5 FROM users WHERE email = $1`,
        [emailFor(isMobile), status, position, card.title, card.note ?? ""],
      );
    }
  });
}

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

const titles = (page: Page) => page.getByRole("heading", { level: 3 });
const openCard = (page: Page, title: string) => page.getByRole("button", { name: title, exact: true });
const dialog = (page: Page) => page.getByRole("dialog");
const isPatch = (r: Response) => /\/api\/v1\/todos\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH";
const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("open a card, write a note, see it saved, and find it again after a reload; there is no Save button", async ({ page, isMobile }) => {
  await seedCards(isMobile, [{ title: "Revise chapter 1" }]);
  await signInOnBoard(page, isMobile);

  await openCard(page, "Revise chapter 1").click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("textbox", { name: "Title" })).toHaveValue("Revise chapter 1");
  await expect(dialog(page).getByText("0 / 2000")).toBeVisible();
  await expect(dialog(page).getByText("To do", { exact: true })).toBeVisible();
  await expect(dialog(page).getByText("In this column since")).toBeVisible();

  await dialog(page).getByRole("textbox", { name: "Note" }).fill("Focus on the proofs.");
  await expect(dialog(page).getByText("20 / 2000")).toBeVisible();
  await expect(dialog(page).getByText("Saved", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^save$/i })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("Focus on the proofs.").locator("visible=true")).toBeVisible();
  await openCard(page, "Revise chapter 1").click();
  await expect(dialog(page).getByRole("textbox", { name: "Note" })).toHaveValue("Focus on the proofs.");
});

test("the title is saved too, and closing right after typing still saves it", async ({ page, isMobile }) => {
  await seedCards(isMobile, [{ title: "Old title" }]);
  await signInOnBoard(page, isMobile);
  await openCard(page, "Old title").click();
  await dialog(page).getByRole("textbox", { name: "Title" }).fill("New title");
  // The board shows the new title at once, before anything is saved.
  await expect(page.locator("h3", { hasText: "New title" }).first()).toBeAttached();
  const saved = page.waitForResponse(isPatch);
  await page.keyboard.press("Escape");
  expect((await saved).status()).toBe(200);
  await page.reload();
  await expect(titles(page)).toHaveText(["New title"]);
});

test("an empty title on a note card shows an error and saves nothing", async ({ page, isMobile }) => {
  await seedCards(isMobile, [{ title: "Keep this title", note: "a note" }]);
  await signInOnBoard(page, isMobile);
  await openCard(page, "Keep this title").click();
  const refused = page.waitForResponse(isPatch);
  await dialog(page).getByRole("textbox", { name: "Title" }).fill("");
  expect((await refused).status()).toBe(400);
  await expect(dialog(page).getByText("A card needs a title.")).toBeVisible();
  await expect(dialog(page).getByRole("textbox", { name: "Title" })).toHaveAttribute("aria-invalid", "true");

  // Typing a title again clears the error and saves.
  const ok = page.waitForResponse(isPatch);
  await dialog(page).getByRole("textbox", { name: "Title" }).fill("Fixed title");
  expect((await ok).status()).toBe(200);
  await expect(dialog(page).getByText("A card needs a title.")).toHaveCount(0);

  // And an empty title that is closed over leaves the old one on the board and the server.
  const again = page.waitForResponse(isPatch);
  await dialog(page).getByRole("textbox", { name: "Title" }).fill("");
  expect((await again).status()).toBe(400);
  await page.keyboard.press("Escape");
  await expect(titles(page)).toHaveText(["Fixed title"]);
  await page.reload();
  await expect(titles(page)).toHaveText(["Fixed title"]);
});

test("delete from the card view asks first, then Undo brings the card back in the same place", async ({ page, isMobile }) => {
  await seedCards(isMobile, [{ title: "First" }, { title: "Second" }, { title: "Third" }]);
  await signInOnBoard(page, isMobile);
  await expect(titles(page)).toHaveText(["First", "Second", "Third"]);

  await openCard(page, "Second").click();
  await dialog(page).getByRole("button", { name: "Delete card" }).click();
  await expect(dialog(page).getByText("Delete this card?")).toBeVisible();
  // Cancel keeps it.
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dialog(page).getByText("Delete this card?")).toHaveCount(0);
  await dialog(page).getByRole("button", { name: "Delete card" }).click();
  await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();

  await expect(dialog(page)).toHaveCount(0);
  await expect(titles(page)).toHaveText(["First", "Third"]);
  await expect(page.getByText("Card deleted")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(titles(page)).toHaveText(["First", "Second", "Third"]);

  await page.reload();
  await expect(titles(page)).toHaveText(["First", "Second", "Third"]);
});

test("delete from the card menu has no question, and without Undo the card stays gone", async ({ page, isMobile }) => {
  await seedCards(isMobile, [{ title: "Keep me" }, { title: "Drop me" }]);
  await signInOnBoard(page, isMobile);

  await page.getByRole("button", { name: "Actions for Drop me" }).click();
  const deleted = page.waitForResponse((r) => r.request().method() === "DELETE");
  await page.getByRole("menuitem", { name: "Delete" }).click();
  expect((await deleted).status()).toBe(204);
  await expect(titles(page)).toHaveText(["Keep me"]);
  await expect(page.getByText("Card deleted")).toBeVisible();
  // The focus goes to a sensible place, not to the top of the page.
  await expect(openCard(page, "Keep me")).toBeFocused();

  await expect(page.getByText("Card deleted")).toHaveCount(0, { timeout: 15_000 });
  await page.reload();
  await expect(titles(page)).toHaveText(["Keep me"]);
});

test("keyboard: Enter opens a card, Esc closes it and the focus returns to the card", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow on desktop");
  await seedCards(isMobile, [{ title: "Alpha" }, { title: "Beta" }]);
  await signInOnBoard(page, isMobile);

  await page.getByRole("button", { name: /New card/ }).focus();
  await page.keyboard.press("Tab");
  await expect(openCard(page, "Alpha")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Actions for Alpha" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(openCard(page, "Beta")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(openCard(page, "Beta")).toBeFocused();

  // Space opens too.
  await page.keyboard.press("Space");
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");

  // Undo can be used from the keyboard.
  await page.getByRole("button", { name: "Actions for Beta" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Delete" }).press("Enter");
  await expect(titles(page)).toHaveText(["Alpha"]);
  const undo = page.getByRole("button", { name: "Undo" });
  await undo.focus();
  await expect(undo).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(titles(page)).toHaveText(["Alpha", "Beta"]);
});

test("phone: the card view fits the screen, and delete and Undo work", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await seedCards(isMobile, [{ title: "Phone one" }, { title: "Phone two" }]);
  await signInOnBoard(page, isMobile);

  await openCard(page, "Phone one").click();
  await expect(dialog(page)).toHaveCSS("transform", "none"); // the opening animation has finished
  const box = (await dialog(page).boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
  expect(await noHorizontalScroll(page)).toBe(true);
  const close = dialog(page).getByRole("button", { name: "Close" });
  const closeBox = (await close.boundingBox())!;
  expect(closeBox.width).toBeGreaterThanOrEqual(44);
  expect(closeBox.height).toBeGreaterThanOrEqual(44);
  // Stacked: the delete action is below the title field.
  const titleBox = (await dialog(page).getByRole("textbox", { name: "Title" }).boundingBox())!;
  const deleteBox = (await dialog(page).getByRole("button", { name: "Delete card" }).boundingBox())!;
  expect(deleteBox.y).toBeGreaterThan(titleBox.y + titleBox.height);

  await dialog(page).getByRole("textbox", { name: "Note" }).fill("on a phone");
  await expect(dialog(page).getByText("Saved", { exact: true })).toBeVisible();
  await dialog(page).getByRole("button", { name: "Delete card" }).click();
  await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(titles(page)).toHaveText(["Phone two"]);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(titles(page)).toHaveText(["Phone one", "Phone two"]);
  await expect(page.getByText("on a phone").locator("visible=true")).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test("a failed save says so, retries, and the text is saved once the server answers", async ({ page, isMobile }) => {
  test.skip(isMobile, "same code path on desktop");
  await seedCards(isMobile, [{ title: "Flaky" }]);
  await signInOnBoard(page, isMobile);
  let failures = 1;
  await page.route(/\/api\/v1\/todos\/[^/]+$/, (route) => {
    if (route.request().method() === "PATCH" && failures-- > 0) return route.fulfill({ status: 500, body: "{}" });
    return route.continue();
  });
  await openCard(page, "Flaky").click();
  await dialog(page).getByRole("textbox", { name: "Note" }).fill("typed while the server was down");
  await expect(dialog(page).getByRole("status")).toHaveText("Couldn't save, retrying");
  await expect(dialog(page).getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByText("typed while the server was down").locator("visible=true")).toBeVisible();
});

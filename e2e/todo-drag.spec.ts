import { randomBytes } from "node:crypto";
import { expect, test, type Locator, type Page, type Response } from "@playwright/test";
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

const emailFor = (isMobile: boolean) => `todo-drag-${isMobile ? "phone" : "desktop"}@example.com`;

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


const column = (page: Page, name: string) => page.locator(`section[aria-label="${name}"]`);
const cardsIn = (page: Page, name: string) => column(page, name).getByRole("heading", { level: 3 });
const card = (page: Page, title: string) => page.locator("article:visible", { has: page.getByRole("heading", { level: 3, name: title }) });
const isMove = (r: Response) => /\/todos\/[^/]+\/move$/.test(r.url()) && r.request().method() === "POST";
const dialog = (page: Page) => page.getByRole("dialog");
const liveRegion = (page: Page) => page.locator("[id^=DndLiveRegion]");

// Counts only this test student's cards (other specs run at the same time).
async function titlesIn(isMobile: boolean, status: string): Promise<string[]> {
  return withDb(async (client) => {
    const { rows } = await client.query<{ title: string }>(
      `SELECT t.title FROM todos t JOIN users u ON u.id = t.user_id
       WHERE u.email = $1 AND t.status = $2 AND t.deleted_at IS NULL ORDER BY t.position`,
      [emailFor(isMobile), status],
    );
    return rows.map((r) => r.title);
  });
}

// A mouse drag in small steps, so dnd-kit sees real movement.
async function dragTo(page: Page, from: Locator, to: Locator, where: "centre" | "top" = "centre") {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + (where === "top" ? 4 : b.height / 2), { steps: 20 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

test("desktop: dragging a card from To do to Done moves it, shows the Done toast and survives a reload", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop drag");
  await seedCards(isMobile, [{ title: "Alpha" }, { title: "Beta" }, { title: "Old one", status: "done" }, { title: "Older one", status: "done" }]);
  await signInOnBoard(page, isMobile);

  const moved = page.waitForResponse(isMove);
  await dragTo(page, card(page, "Alpha"), card(page, "Old one"), "top");
  expect((await moved).status()).toBe(200);
  await expect(cardsIn(page, "Done")).toHaveText(["Alpha", "Old one", "Older one"]);
  await expect(cardsIn(page, "To do")).toHaveText(["Beta"]);
  await expect(page.getByText("Nice, that's done.")).toBeVisible();
  await expect(card(page, "Alpha").getByRole("button", { name: /^(Start|Done)$/ })).toHaveCount(0);
  expect(await titlesIn(isMobile, "done")).toEqual(["Alpha", "Old one", "Older one"]);
  await page.reload();
  await expect(cardsIn(page, "Done")).toHaveText(["Alpha", "Old one", "Older one"]);
  await expect(cardsIn(page, "To do")).toHaveText(["Beta"]);
});

test("desktop: a card can be dropped into an empty column", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop drag");
  await seedCards(isMobile, [{ title: "Alpha" }]);
  await signInOnBoard(page, isMobile);
  const moved = page.waitForResponse(isMove);
  await dragTo(page, card(page, "Alpha"), column(page, "In progress").getByText("Nothing in progress"));
  expect((await moved).status()).toBe(200);
  await expect(cardsIn(page, "In progress")).toHaveText(["Alpha"]);
  await expect(page.getByText("Moved to In progress")).toBeVisible();
  await page.reload();
  await expect(cardsIn(page, "In progress")).toHaveText(["Alpha"]);
  await expect(cardsIn(page, "To do")).toHaveCount(0);
});

test("desktop: dragging within a column reorders it and the order survives a reload", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop drag");
  await seedCards(isMobile, [{ title: "One" }, { title: "Two" }, { title: "Three" }]);
  await signInOnBoard(page, isMobile);
  const moved = page.waitForResponse(isMove);
  await dragTo(page, card(page, "Three"), card(page, "One"), "top");
  expect((await moved).status()).toBe(200);
  await expect(cardsIn(page, "To do")).toHaveText(["Three", "One", "Two"]);
  await expect(page.getByText("Moved up")).toBeVisible();
  expect(await titlesIn(isMobile, "todo")).toEqual(["Three", "One", "Two"]);
  await page.reload();
  await expect(cardsIn(page, "To do")).toHaveText(["Three", "One", "Two"]);
});

test("desktop: a click without movement opens the card view", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop drag");
  await seedCards(isMobile, [{ title: "Alpha" }, { title: "Beta" }]);
  await signInOnBoard(page, isMobile);
  await card(page, "Alpha").click({ position: { x: 60, y: 30 } });
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(cardsIn(page, "To do")).toHaveText(["Alpha", "Beta"]);
});

test("desktop: pressing the actions button and moving does not drag the card", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop drag");
  await seedCards(isMobile, [{ title: "Alpha" }, { title: "Beta" }]);
  await signInOnBoard(page, isMobile);
  let moves = 0;
  page.on("response", (r) => isMove(r) && moves++);
  const button = card(page, "Alpha").getByRole("button", { name: "Actions for Alpha" });
  const a = (await button.boundingBox())!;
  const target = (await column(page, "Done").boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  // Up and to the right, away from the menu that the press opens under the button.
  await page.mouse.move(target.x + target.width - 10, target.y + 10, { steps: 15 });
  await expect(page.locator("[aria-hidden][inert]")).toHaveCount(0);
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(moves).toBe(0);
  await page.keyboard.press("Escape");
  await expect(cardsIn(page, "To do")).toHaveText(["Alpha", "Beta"]);
});

test("desktop: keyboard drag with Space and the arrows moves a card and announces it; Enter opens the card", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop drag");
  await seedCards(isMobile, [{ title: "Alpha" }, { title: "Beta" }, { title: "Working", status: "in_progress" }]);
  await signInOnBoard(page, isMobile);

  const title = card(page, "Alpha").locator("[data-card-open]");
  await title.focus();
  await expect(title).toHaveAttribute("aria-roledescription", "sortable");
  await page.keyboard.press("Space");
  await expect(liveRegion(page)).toContainText(/(Picked up Alpha\. |Alpha is over )To do, position 1 of 2\./);
  await expect(dialog(page)).toHaveCount(0);
  await page.waitForTimeout(250);
  await page.keyboard.press("ArrowRight");
  await expect(liveRegion(page)).toContainText(/Alpha is over In progress, position \d of 2\./);
  await page.waitForTimeout(250);
  const moved = page.waitForResponse(isMove);
  await page.keyboard.press("Space");
  await expect(liveRegion(page)).toContainText(/Dropped Alpha in In progress, position \d of 2\./);
  expect((await moved).status()).toBe(200);
  await expect(dialog(page)).toHaveCount(0);
  await expect(cardsIn(page, "In progress")).toHaveCount(2);
  await expect(column(page, "In progress").getByRole("heading", { level: 3, name: "Alpha" })).toBeVisible();
  await expect(cardsIn(page, "To do")).toHaveText(["Beta"]);
  await expect(page.getByText("Moved to In progress")).toBeVisible();
  await expect(card(page, "Alpha").locator("[data-card-open]")).toBeFocused();
  expect(await titlesIn(isMobile, "in_progress")).toContain("Alpha");
  await page.reload();
  await expect(cardsIn(page, "To do")).toHaveText(["Beta"]);
  await expect(cardsIn(page, "In progress")).toHaveCount(2);

  // Esc cancels a pick-up: nothing moves, no dialog, and the card keeps the focus.
  const beta = card(page, "Beta").locator("[data-card-open]");
  await beta.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await expect(liveRegion(page)).toContainText("Cancelled. Beta went back to To do, position 1.");
  await expect(cardsIn(page, "To do")).toHaveText(["Beta"]);
  await expect(dialog(page)).toHaveCount(0);
  await expect(card(page, "Beta").locator("[data-card-open]")).toBeFocused();

  // Enter opens the card view.
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();
});

test("phone: the board has no drag handlers", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await seedCards(isMobile, [{ title: "Alpha" }, { title: "Beta" }]);
  await signInOnBoard(page, isMobile);
  await expect(card(page, "Alpha")).toBeVisible();
  await expect(page.locator("[aria-roledescription=sortable]")).toHaveCount(0);
  await expect(page.locator("[id^=DndLiveRegion]")).toHaveCount(0);
  // Space still opens a card on a phone.
  await card(page, "Alpha").locator("[data-card-open]").focus();
  await page.keyboard.press("Space");
  await expect(dialog(page)).toBeVisible();
});

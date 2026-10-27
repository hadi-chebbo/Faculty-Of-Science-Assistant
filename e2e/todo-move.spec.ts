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

const emailFor = (isMobile: boolean) => `todo-move-${isMobile ? "phone" : "desktop"}@example.com`;

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
// The cards of the column that is on screen (a phone shows one at a time).
const shown = (page: Page) => page.locator("article:visible").getByRole("heading", { level: 3 });
const card = (page: Page, title: string) => page.locator("article:visible", { has: page.getByRole("heading", { level: 3, name: title }) });
const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
// Toasts stack, so the Undo button is looked up in the toast with the given message.
const undoButton = (page: Page, message: string) =>
  page.locator("[data-sonner-toast]", { hasText: message }).getByRole("button", { name: "Undo" });
const isMove = (r: Response) => /\/todos\/[^/]+\/move$/.test(r.url()) && r.request().method() === "POST";
const dialog = (page: Page) => page.getByRole("dialog");

async function menu(page: Page, title: string) {
  await card(page, title).getByRole("button", { name: `Actions for ${title}` }).click();
}

test("desktop: Start, Done and Undo move a card between columns, and the state survives a reload", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout");
  await seedCards(isMobile, [
    { title: "Existing in progress", status: "in_progress" },
    { title: "Existing done", status: "done" },
  ]);
  await signInOnBoard(page, isMobile);
  await column(page, "To do").getByRole("button", { name: "Add a card", exact: true }).click();
  await page.getByRole("textbox", { name: "New card in To do" }).fill("Revise sorting");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(cardsIn(page, "To do")).toHaveText(["Revise sorting"]);
  // Only To do cards have Start; only In progress cards have Done.
  await expect(card(page, "Existing in progress").getByRole("button", { name: "Start" })).toHaveCount(0);
  await expect(card(page, "Existing done").getByRole("button", { name: /^(Start|Done)$/ })).toHaveCount(0);

  const started = page.waitForResponse(isMove);
  await card(page, "Revise sorting").getByRole("button", { name: "Start" }).click();
  expect((await started).status()).toBe(200);
  await expect(cardsIn(page, "In progress")).toHaveText(["Revise sorting", "Existing in progress"]);
  await expect(page.getByText("Moved to In progress")).toBeVisible();
  await expect(card(page, "Revise sorting").getByRole("button", { name: "Start" })).toHaveCount(0);

  await card(page, "Revise sorting").getByRole("button", { name: "Done", exact: true }).click();
  await expect(cardsIn(page, "Done")).toHaveText(["Revise sorting", "Existing done"]);
  await expect(page.getByText("Nice, that's done.")).toBeVisible();
  await expect(card(page, "Revise sorting").getByText("Done just now")).toBeVisible();
  await expect(card(page, "Revise sorting").getByRole("heading", { level: 3 })).toHaveCSS("text-decoration-line", "line-through");
  await expect(card(page, "Revise sorting").getByRole("button", { name: /^(Start|Done)$/ })).toHaveCount(0);

  // Undo puts it back at the top of In progress.
  // The Undo request itself (back to In progress), not the slower answer to the earlier move to Done.
  const undone = page.waitForResponse((r) => isMove(r) && (r.request().postData() ?? "").includes('"status":"in_progress"'));
  await undoButton(page, "Nice, that's done.").click();
  expect((await undone).status()).toBe(200);
  await expect(cardsIn(page, "In progress")).toHaveText(["Revise sorting", "Existing in progress"]);
  await expect(cardsIn(page, "Done")).toHaveText(["Existing done"]);

  await page.reload();
  await expect(cardsIn(page, "In progress")).toHaveText(["Revise sorting", "Existing in progress"]);
  await expect(cardsIn(page, "Done")).toHaveText(["Existing done"]);
});

test("desktop: the menu moves a card down and up, ends are disabled, Move to sends it to the top of a column", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout");
  await seedCards(isMobile, [{ title: "One" }, { title: "Two" }, { title: "Three" }, { title: "Finished", status: "done" }]);
  await signInOnBoard(page, isMobile);

  await menu(page, "One");
  await expect(page.getByRole("menuitem", { name: "Move up" })).toHaveAttribute("aria-disabled", "true");
  const down = page.waitForResponse(isMove);
  await page.getByRole("menuitem", { name: "Move down" }).click();
  await down;
  await expect(cardsIn(page, "To do")).toHaveText(["Two", "One", "Three"]);
  await expect(page.getByText("Moved down")).toBeVisible();
  // The focus follows the card to its new place.
  await expect(card(page, "One").locator("[data-card-open]")).toBeFocused();

  await menu(page, "Three");
  await expect(page.getByRole("menuitem", { name: "Move down" })).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("menuitem", { name: "Move up" }).click();
  await expect(cardsIn(page, "To do")).toHaveText(["Two", "Three", "One"]);
  await expect(page.getByText("Moved up")).toBeVisible();

  await menu(page, "Three");
  await page.getByRole("menuitem", { name: "Done", exact: true }).click();
  await expect(cardsIn(page, "Done")).toHaveText(["Three", "Finished"]);
  await expect(page.getByText("Nice, that's done.")).toBeVisible();
  // The Undo request itself (back to To do), not the slower answer to the earlier move to Done.
  const undone = page.waitForResponse((r) => isMove(r) && (r.request().postData() ?? "").includes('"status":"todo"'));
  await undoButton(page, "Nice, that's done.").click();
  await expect(cardsIn(page, "To do")).toHaveText(["Two", "Three", "One"]);
  await undone;

  await page.reload();
  await expect(cardsIn(page, "To do")).toHaveText(["Two", "Three", "One"]);
  await expect(cardsIn(page, "Done")).toHaveText(["Finished"]);
});

test("the card view's status list moves the card and the dialog stays open", async ({ page, isMobile }) => {
  await seedCards(isMobile, [{ title: "Open me", note: "keep" }, { title: "Done already", status: "done" }]);
  await signInOnBoard(page, isMobile);
  await page.getByRole("button", { name: "Open me", exact: true }).locator("visible=true").click();
  await expect(dialog(page).getByRole("button", { name: "To do", pressed: true })).toBeVisible();
  // A note typed just before the move is not lost.
  await dialog(page).getByRole("textbox", { name: "Note" }).fill("keep this too");
  const moved = page.waitForResponse(isMove);
  await dialog(page).getByRole("button", { name: "Done", exact: true }).click();
  expect((await moved).status()).toBe(200);
  await expect(dialog(page).getByRole("button", { name: "Done", pressed: true })).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "To do", pressed: false })).toBeVisible();
  await expect(dialog(page).getByText("In this column since")).toBeVisible();
  await expect(dialog(page).locator("dd", { hasText: "just now" }).last()).toBeVisible();
  await expect(page.getByText("Nice, that's done.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  if (isMobile) await tab(page, "Done").click();
  await expect(shown(page)).toHaveText(["Open me", "Done already"]);
  await page.reload();
  if (isMobile) await tab(page, "Done").click();
  await expect(shown(page)).toHaveText(["Open me", "Done already"]);
  await expect(page.getByText("keep this too").locator("visible=true")).toBeVisible();
});

test("phone: Start, Done and Move up/down work and the tab counts follow", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await seedCards(isMobile, [{ title: "Alpha" }, { title: "Beta" }]);
  await signInOnBoard(page, isMobile);
  await expect(tab(page, "To do")).toHaveText("To do2");

  // The buttons are at least 44px tall.
  const box = await card(page, "Alpha").getByRole("button", { name: "Start" }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);

  await menu(page, "Alpha");
  await page.getByRole("menuitem", { name: "Move down" }).click();
  await expect(shown(page)).toHaveText(["Beta", "Alpha"]);
  await expect(page.getByText("Moved down")).toBeVisible();

  await card(page, "Alpha").getByRole("button", { name: "Start" }).click();
  await expect(tab(page, "To do")).toHaveText("To do1");
  await expect(tab(page, "In progress")).toHaveText("In progress1");
  await expect(page.getByText("Moved to In progress")).toBeVisible();
  // The Undo button is reachable and the focus did not fall to the page.
  await expect(undoButton(page, "Moved to In progress")).toBeVisible();
  await expect(page.locator("body")).not.toBeFocused();
  await undoButton(page, "Moved to In progress").click();
  await expect(tab(page, "To do")).toHaveText("To do2");
  await expect(shown(page)).toHaveText(["Beta", "Alpha"]);

  await card(page, "Beta").getByRole("button", { name: "Start" }).click();
  await tab(page, "In progress").click();
  await card(page, "Beta").getByRole("button", { name: "Done", exact: true }).click();
  await expect(tab(page, "Done")).toHaveText("Done1");
  await expect(tab(page, "In progress")).toHaveText("In progress0");
  await tab(page, "Done").click();
  await expect(shown(page)).toHaveText(["Beta"]);
  await page.reload();
  await expect(tab(page, "Done")).toHaveText("Done1");
});

test("reaching Done plays the celebration, and nothing animates with reduced motion", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout");
  await seedCards(isMobile, [
    { title: "Animated", status: "in_progress" },
    { title: "Still", status: "in_progress" },
  ]);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await signInOnBoard(page, isMobile);
  await card(page, "Animated").getByRole("button", { name: "Done", exact: true }).click();
  await expect.poll(() => card(page, "Animated").evaluate((el) => el.getAnimations().length)).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await card(page, "Still").getByRole("button", { name: "Done", exact: true }).click();
  await expect(cardsIn(page, "Done")).toHaveText(["Still", "Animated"]);
  await expect(page.getByText("Nice, that's done.").first()).toBeVisible();
  const running = await card(page, "Still").evaluate(
    (el) => [el, ...el.querySelectorAll("*")].flatMap((e) => e.getAnimations()).filter((a) => a instanceof CSSAnimation && a.playState === "running").length,
  );
  expect(running).toBe(0);
  await expect(card(page, "Still")).toHaveCSS("animation-name", "none");
});

test("Done never creates a completion, and a failed move rolls back with a message", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop layout");
  await seedCards(isMobile, [
    { title: "Stays", status: "in_progress" },
    { title: "Moves", status: "in_progress" },
  ]);
  await signInOnBoard(page, isMobile);
  const moved = page.waitForResponse(isMove);
  await card(page, "Moves").getByRole("button", { name: "Done", exact: true }).click();
  await expect(cardsIn(page, "Done")).toHaveText(["Moves"]);
  await moved;
  await page.reload();
  await expect(cardsIn(page, "Done")).toHaveText(["Moves"]);
  const completions = await withDb((client) =>
    client.query(`SELECT count(*)::int AS n FROM completions WHERE user_id = (SELECT id FROM users WHERE email = $1)`, [emailFor(isMobile)]),
  );
  expect(completions.rows[0].n).toBe(0);

  await page.route(/\/api\/v1\/todos\/[^/]+\/move$/, (route) => route.fulfill({ status: 500, body: "{}" }));
  await card(page, "Stays").getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText("Couldn't move the card. Try again.")).toBeVisible();
  await expect(cardsIn(page, "In progress")).toHaveText(["Stays"]);
  await expect(cardsIn(page, "Done")).toHaveText(["Moves"]);
});

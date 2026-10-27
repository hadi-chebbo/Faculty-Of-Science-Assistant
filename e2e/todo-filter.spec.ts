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

const emailFor = (isMobile: boolean) => `todo-filter-${isMobile ? "phone" : "desktop"}@example.com`;

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

type Seed = { title: string; status?: string; note?: string; file?: [string, string] };

// Cards for the test student, top to bottom within their column; `file` links a demo resource
// (course code, resource title).
async function seedCards(isMobile: boolean, cards: Seed[]) {
  await withDb(async (client) => {
    const positions: Record<string, number> = {};
    for (const card of cards) {
      const status = card.status ?? "todo";
      const position = (positions[status] = (positions[status] ?? -1) + 1);
      await client.query(
        `INSERT INTO todos (user_id, status, position, title, note, resource_id)
         SELECT u.id, $2, $3, $4, $5,
                (SELECT r.id FROM resources r JOIN courses c ON c.id = r.course_id WHERE c.code = $6 AND r.title = $7)
         FROM users u WHERE u.email = $1`,
        [emailFor(isMobile), status, position, card.title, card.note ?? "", card.file?.[0] ?? null, card.file?.[1] ?? null],
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
// The cards on screen: on a phone the column of the selected tab, on desktop the To do column.
const shown = (page: Page, isMobile: boolean) =>
  isMobile ? page.locator("article:visible").getByRole("heading", { level: 3 }) : cardsIn(page, "To do");
const card = (page: Page, title: string) => page.locator("article:visible", { has: page.getByRole("heading", { level: 3, name: title }) });
const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
const chip = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const filterBox = (page: Page) => page.getByRole("searchbox", { name: "Filter cards" });
const isMove = (r: Response) => /\/todos\/[^/]+\/move$/.test(r.url()) && r.request().method() === "POST";

const CARDS: Seed[] = [
  { title: "Alpha sorting", file: ["DEMO301", "Sample notes"] },
  { title: "Beta graphs", note: "ask about Dijkstra" },
  { title: "Gamma trees", file: ["DEMO301", "Sample lecture 1"] },
  { title: "Delta networks", file: ["DEMO301", "Sample lecture 2"] },
  { title: "Theta systems", file: ["DEMO502", "Sample lecture 1"] },
  { title: "Epsilon plain", status: "in_progress" },
  { title: "Zeta linked", status: "in_progress", file: ["DEMO301", "Sample notes"] },
  { title: "Eta finished", status: "done", note: "graphs again" },
];

test("chips list the courses with cards; a course chip, Notes only and All filter every column", async ({ page, isMobile }) => {
  await seedCards(isMobile, CARDS);
  await signInOnBoard(page, isMobile);
  await expect(chip(page, "All")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "DEMO301")).toBeVisible();
  await expect(chip(page, "DEMO502")).toBeVisible();
  await expect(chip(page, "DEMO101")).toHaveCount(0);
  await expect(chip(page, "Notes only")).toBeVisible();

  await chip(page, "DEMO301").click();
  await expect(chip(page, "DEMO301")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "All")).toHaveAttribute("aria-pressed", "false");
  if (isMobile) {
    await expect(shown(page, isMobile)).toHaveText(["Alpha sorting", "Gamma trees", "Delta networks"]);
    await expect(tab(page, "To do")).toContainText("3");
    await expect(tab(page, "In progress")).toContainText("1");
    await expect(tab(page, "Done")).toContainText("0");
    await tab(page, "Done").click();
    await expect(page.getByText("No cards match").locator("visible=true")).toBeVisible();
  } else {
    await expect(cardsIn(page, "To do")).toHaveText(["Alpha sorting", "Gamma trees", "Delta networks"]);
    await expect(cardsIn(page, "In progress")).toHaveText(["Zeta linked"]);
    await expect(cardsIn(page, "Done")).toHaveCount(0);
    await expect(column(page, "Done").getByText("No cards match")).toBeVisible();
    await expect(column(page, "To do")).toContainText("3");
  }

  await chip(page, "Notes only").click();
  if (isMobile) await tab(page, "To do").click();
  await expect(shown(page, isMobile)).toHaveText(["Beta graphs"]);
  await chip(page, "All").click();
  if (isMobile) await tab(page, "To do").click();
  await expect(shown(page, isMobile)).toHaveText(["Alpha sorting", "Beta graphs", "Gamma trees", "Delta networks", "Theta systems"]);
});

test("text matches title, note and course code ignoring case, combines with a chip, and clearing restores", async ({ page, isMobile }) => {
  await seedCards(isMobile, CARDS);
  await signInOnBoard(page, isMobile);
  const pick = async (name: string) => {
    if (isMobile) await tab(page, name).click();
  };

  await filterBox(page).fill("GRAPHS");
  if (isMobile) {
    await expect(tab(page, "To do")).toContainText("1");
    await expect(tab(page, "Done")).toContainText("1");
    await expect(shown(page, isMobile)).toHaveText(["Beta graphs"]);
    await pick("Done");
    await expect(shown(page, isMobile)).toHaveText(["Eta finished"]);
  } else {
    await expect(cardsIn(page, "To do")).toHaveText(["Beta graphs"]);
    await expect(cardsIn(page, "Done")).toHaveText(["Eta finished"]);
    await expect(cardsIn(page, "In progress")).toHaveCount(0);
  }

  // Both must match: the text "graphs" is on no DEMO301 card.
  await chip(page, "DEMO301").click();
  await pick("To do");
  await expect(shown(page, isMobile)).toHaveCount(0);
  await filterBox(page).fill("demo301");
  await expect(shown(page, isMobile)).toHaveText(["Alpha sorting", "Gamma trees", "Delta networks"]);

  await filterBox(page).fill("");
  await chip(page, "All").click();
  await expect(shown(page, isMobile)).toHaveText(["Alpha sorting", "Beta graphs", "Gamma trees", "Delta networks", "Theta systems"]);
  // Nothing is saved: a reload starts unfiltered.
  await filterBox(page).fill("trees");
  await page.reload();
  await expect(filterBox(page)).toHaveValue("");
});

test("Move down while filtered passes the next visible card; the server order keeps the hidden ones", async ({ page, isMobile }) => {
  await seedCards(isMobile, CARDS);
  await signInOnBoard(page, isMobile);
  await chip(page, "DEMO301").click();
  await expect(shown(page, isMobile)).toHaveText(["Alpha sorting", "Gamma trees", "Delta networks"]);

  // Alpha, Beta (hidden), Gamma, Delta: Alpha moves down past Gamma only.
  await card(page, "Alpha sorting").getByRole("button", { name: "Actions for Alpha sorting" }).click();
  await expect(page.getByRole("menuitem", { name: "Move up" })).toHaveAttribute("aria-disabled", "true");
  const moved = page.waitForResponse(isMove);
  await page.getByRole("menuitem", { name: "Move down" }).click();
  expect((await moved).status()).toBe(200);
  await expect(shown(page, isMobile)).toHaveText(["Gamma trees", "Alpha sorting", "Delta networks"]);

  await chip(page, "All").click();
  await expect(shown(page, isMobile)).toHaveText(["Beta graphs", "Gamma trees", "Alpha sorting", "Delta networks", "Theta systems"]);
  await page.reload();
  await expect(shown(page, isMobile)).toHaveText(["Beta graphs", "Gamma trees", "Alpha sorting", "Delta networks", "Theta systems"]);
});

test("adding a card that the filter would hide clears the filter", async ({ page, isMobile }) => {
  await seedCards(isMobile, CARDS);
  await signInOnBoard(page, isMobile);
  await chip(page, "DEMO301").click();
  await page.getByRole("button", { name: isMobile ? "New card" : "Add a card" }).locator("visible=true").first().click();
  await page.getByRole("textbox", { name: /^New card in/ }).fill("Fresh note");
  await page.keyboard.press("Enter");
  await expect(chip(page, "All")).toHaveAttribute("aria-pressed", "true");
  await expect(shown(page, isMobile).first()).toHaveText("Fresh note");
});

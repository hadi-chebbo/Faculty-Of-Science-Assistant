import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed
// The demo data has 8 fixture courses DEMO301 to DEMO602 and four full courses DEMO310, DEMO410,
// DEMO510 and DEMO610, all with "Sample" in their titles. Tests that need an accent write one file
// of their own (in DEMO302, as the reader tests do) and remove it afterwards.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the connection below fails with a clear error.
  }
}

async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

// Letters only, so the token is one word that cannot be taken for a year or a filter word.
const token = () => Array.from(randomBytes(8), (b) => String.fromCharCode(97 + (b % 26))).join("");

// The list items that open a resource's reader page.
function fileRows(page: Page) {
  return page.locator("li").filter({ has: page.locator('a[href^="/resources/"]') });
}

// Text on the page, apart from the live region (which says the same for screen readers).
function shown(page: Page, text: RegExp) {
  return page.getByText(text).and(page.locator(":not([aria-live])"));
}

// A chip, not the item of the same name in the main navigation.
function chip(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Result types" }).getByRole("link", { name, exact: true });
}

function section(page: Page, name: string) {
  return page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: new RegExp(`^${name} ·`) }) });
}

test("the Search nav item leads to /search and is the current page there", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("link", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page).toHaveTitle(/^Search \| University Assistant$/);
  await expect(page.getByRole("heading", { name: "Search", level: 1 })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Search", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Exams", exact: true })).not.toHaveAttribute("aria-current", "page");
});

test("before typing it shows hints and a link to every semester", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByText("Try a course code (DEMO301), a topic (graphs), or an exam (final 2024). Accents don't matter.")).toBeVisible();
  for (const semester of [3, 4, 5, 6]) {
    await expect(page.getByRole("link", { name: `Semester ${semester}`, exact: true })).toHaveAttribute("href", `/semesters/${semester}`);
  }
  // One character is still too short: the same hints, no results.
  await page.goto("/search?q=d");
  await expect(page.getByText("Or browse a semester")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Result types" })).toHaveCount(0);

  await page.getByRole("link", { name: "Semester 5", exact: true }).click();
  await expect(page).toHaveURL(/\/semesters\/5$/);
});

test("a session word beside plain words is text, not a filter", async ({ page }) => {
  await page.goto("/search?q=partial+derivatives");
  await expect(shown(page, /^Showing /)).toHaveCount(0);
  await expect(chip(page, "All")).toHaveAttribute("aria-current", "true");
  await page.goto("/search?q=final");
  await expect(shown(page, /^Showing final exams · \d+ results?$/)).toBeVisible();
});

test("a very long query of astral characters is trimmed, not an error", async ({ page }) => {
  const response = await page.goto(`/search?q=${encodeURIComponent("𝐀".repeat(150))}`);
  expect(response?.status()).toBe(200);
  await expect(shown(page, /No results for/).first()).toBeVisible();
  const sixty = await page.goto(`/search?q=${encodeURIComponent("𝐀".repeat(60))}`);
  expect(sixty?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 2, name: /No results for/ })).toBeVisible();
});

test("one live region announces the summary, including no results", async ({ page }) => {
  await page.goto("/search?q=final+2024");
  const live = page.locator("main [aria-live]");
  await expect(live).toHaveCount(1);
  await expect(live).toHaveText(/^Showing final exams from 2024-2025 · \d+ results?$/);
  await page.goto("/search?q=zzqqxx");
  await expect(page.locator("main [aria-live]")).toHaveText("No results for “zzqqxx”");
  await page.goto("/search");
  await expect(page.locator("main [aria-live]")).toHaveCount(1);
});

test("typed text survives a slow answer to an earlier keystroke", async ({ page }) => {
  await page.goto("/search");
  const box = page.getByRole("searchbox", { name: "Search courses, chapters and files" });
  // Hydrated once typing leads to a request; every request is then held back for a while.
  await expect(async () => {
    await box.fill("");
    await box.pressSequentially("demo", { delay: 20 });
    await expect(page).toHaveURL(/q=demo$/, { timeout: 1500 });
  }).toPass();
  await box.fill("");
  await expect(page).toHaveURL(/\/search$/);
  await page.route(/_rsc=/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await box.pressSequentially("algo", { delay: 20 });
  // The address is replaced after 300 ms and its answer is slow: type on while it is on its way.
  await page.waitForTimeout(500);
  await box.pressSequentially("r");
  await expect(page).toHaveURL(/q=algor$/);
  // After the late answers have arrived the box still holds what was typed, caret at the end.
  await page.waitForTimeout(2800);
  await expect(box).toHaveValue("algor");
  expect(await box.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([5, 5]);
});

test("the chip in effect is in view in the row, also on a phone", async ({ page }) => {
  await page.goto("/search?q=final+2024");
  const active = chip(page, "Exams");
  await expect(active).toHaveAttribute("aria-current", "true");
  // Once the row has scrolled (after hydration) the whole chip is inside the window.
  await expect(async () => {
    const box = (await active.boundingBox())!;
    const width = page.viewportSize()!.width;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  }).toPass();
  // Only the row scrolled, not the page.
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
});

test("the Search button is visible while it has the keyboard focus", async ({ page }) => {
  await page.goto("/search");
  const button = page.getByRole("button", { name: "Search", exact: true });
  await page.getByRole("searchbox").focus();
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();
  // (The button animates its size a moment as it changes.)
  await expect.poll(async () => (await button.boundingBox())?.height).toBeGreaterThan(40);
  expect((await button.boundingBox())!.width).toBeGreaterThan(40);
});

test("the box is a search field with a keyboard that says Search", async ({ page }) => {
  await page.goto("/search");
  const box = page.getByRole("searchbox", { name: "Search courses, chapters and files" });
  await expect(box).toHaveAttribute("enterkeyhint", "search");
  await expect(box).toHaveAttribute("type", "search");
});

test("typing updates the results and the address without adding history, and Back leaves the page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  const box = page.getByRole("searchbox", { name: "Search courses, chapters and files" });
  await expect(async () => {
    // Before the page has hydrated typing does nothing (the Search button still works).
    await box.fill("");
    await box.pressSequentially("demo301", { delay: 40 });
    await expect(page).toHaveURL(/\/search\?q=demo301$/, { timeout: 1500 });
  }).toPass();
  const first = section(page, "Courses").getByRole("link").first();
  await expect(first).toContainText("DEMO301");
  await expect(first).toContainText("Sample Course A");
  await expect(first).toContainText("Semester 3");

  // Changing the text again replaces the address in place.
  const before = await page.evaluate(() => history.length);
  await box.fill("DEMO401");
  await expect(page).toHaveURL(/\/search\?q=DEMO401$/);
  await expect(section(page, "Courses").getByRole("link").first()).toContainText("DEMO401");
  expect(await page.evaluate(() => history.length)).toBe(before);

  // Clearing goes back to the hints.
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByText("Or browse a semester")).toBeVisible();
  await expect(box).toHaveValue("");

  // No history entry per keystroke: one Back leaves the search page for the one before it.
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test("Back after a chip returns to the earlier state and the box follows the address", async ({ page }) => {
  await page.goto("/search?q=sample");
  await chip(page, "Exams").click();
  await expect(page).toHaveURL(/q=sample&type=exam$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/search\?q=sample$/);
  await expect(page.getByRole("searchbox")).toHaveValue("sample");
  await page.goto("/search?q=demo301");
  await expect(page.getByRole("searchbox")).toHaveValue("demo301");
});

test("a course code finds its course first, with or without a space and in any case", async ({ page }) => {
  for (const q of ["DEMO301", "demo301", "demo 301", "Demo  301"]) {
    await page.goto(`/search?q=${encodeURIComponent(q)}`);
    await expect(section(page, "Courses")).toBeVisible();
    const courses = section(page, "Courses").getByRole("link");
    await expect(courses.first()).toContainText("DEMO301");
    await expect(courses.first()).toHaveAttribute("href", "/courses/DEMO301");
  }
  // A prefix of the code finds every course that starts with it, in code order.
  await page.goto("/search?q=demo30");
  await expect(section(page, "Courses").getByRole("link").nth(0)).toContainText("DEMO301");
  await expect(section(page, "Courses").getByRole("link").nth(1)).toContainText("DEMO302");
});

test("a course card says the semester, the chapters and the files", async ({ page }) => {
  await page.goto("/search?q=demo301");
  await expect(section(page, "Courses").getByRole("link").first()).toContainText(/Semester 3 · 3 chapters · \d+ files?/);
});

test("a chapter result links to the chapter page", async ({ page }) => {
  await page.goto("/search?q=sample+chapter+2");
  const chapters = section(page, "Chapters");
  await expect(chapters).toBeVisible();
  const link = chapters.getByRole("link", { name: /DEMO301/ });
  await expect(link).toContainText("DEMO301 · Sample Course A");
  await link.click();
  await expect(page).toHaveURL(/\/courses\/DEMO301\/chapters\/2$/);
});

test("a query without accents finds an accented title", async ({ page }) => {
  const word = token();
  const title = `Théorie ensembliste ${word}`;
  const id = await withDb(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO resources (course_id, type, title, description, language, file_key, is_published)
       SELECT id, 'lecture', $2, $3, 'fr', $1, true FROM courses WHERE code = 'DEMO302' RETURNING id`,
      [`resources/${randomUUID()}.pdf`, title, `Résumé détaillé ${word}`],
    );
    return rows[0].id as string;
  });
  try {
    await page.goto(`/search?q=${encodeURIComponent(`theorie ENSEMBLISTE ${word}`)}`);
    await expect(fileRows(page)).toHaveCount(1);
    await expect(fileRows(page).first()).toContainText(title);
    // The matched words are marked in the title, accents kept.
    await expect(fileRows(page).first().locator("mark")).toHaveText(["Théorie", "ensembliste", word]);
    await expect(fileRows(page).first()).toContainText("DEMO302");
    await expect(fileRows(page).first()).toContainText("FR");

    // Found by words of the description that the title lacks: a snippet shows them marked.
    await page.goto(`/search?q=${encodeURIComponent(`resume detaille ${word}`)}`);
    await expect(fileRows(page)).toHaveCount(1);
    await expect(fileRows(page).first().locator("mark")).toHaveText([word, "Résumé", "détaillé"]);
    await expect(fileRows(page).first()).toContainText(`Résumé détaillé ${word}`);

  } finally {
    await withDb((client) => client.query("DELETE FROM resources WHERE id = $1", [id]));
  }
});

test("matches are bold heading text with no background", async ({ page }) => {
  await page.goto("/search?q=sample+lect");
  const mark = fileRows(page).first().locator("mark").first();
  await expect(mark).toHaveText("Sample");
  const style = await mark.evaluate((el) => {
    const css = getComputedStyle(el);
    return { weight: css.fontWeight, background: css.backgroundColor, color: css.color, parent: getComputedStyle(el.parentElement!).color };
  });
  expect(Number(style.weight)).toBeGreaterThanOrEqual(700);
  expect(style.background).toBe("rgba(0, 0, 0, 0)");
  expect(style.color).toBe(style.parent);
  // Only the start of a word is marked: "lect" inside "Sample lecture".
  await expect(fileRows(page).first().locator("mark")).toHaveText(["Sample", "lect"]);
});

test("a file that matches only in its description shows a snippet with the word marked", async ({ page }) => {
  // The demo lecture "Sample lecture 1" of DEMO301 has the description "Sample introduction slides."
  await page.goto("/search?q=introduction");
  const row = fileRows(page).filter({ hasText: "Sample lecture 1" }).first();
  await expect(row).toContainText("Sample introduction slides.");
  await expect(row.locator("mark")).toHaveText("introduction");
});

test("words that name a type, session or year filter the files and select the chip", async ({ page }) => {
  await page.goto("/search?q=final+2024");
  const line = shown(page, /^Showing final exams from 2024-2025 · \d+ results?$/);
  await expect(line).toBeVisible();
  await expect(line.locator("b")).toHaveText(["final", "2024-2025"]);
  await expect(chip(page, "Exams")).toHaveAttribute("aria-current", "true");
  await expect(chip(page, "All")).not.toHaveAttribute("aria-current", "true");
  // Only the list of files: no courses or chapters when nothing is left to search for.
  await expect(page.getByRole("heading", { level: 2, name: /^Courses/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: /^Chapters/ })).toHaveCount(0);
  const count = Number((await line.innerText()).match(/· (\d+) result/)![1]);
  expect(count).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { level: 2, name: `Files · ${count}` })).toBeVisible();
  const rows = fileRows(page);
  for (let i = 0; i < Math.min(await rows.count(), 5); i++) {
    await expect(rows.nth(i)).toContainText("2024-2025");
    await expect(rows.nth(i)).toContainText("Final");
    await expect(rows.nth(i)).toContainText("Exam");
  }
  // Filter words are not marked.
  await expect(page.locator("main mark")).toHaveCount(0);

  // French, and a long form of the year, say the same.
  await page.goto("/search?q=examen+partiel+2024%2F2025");
  await expect(shown(page, /^Showing partial exams from 2024-2025 · \d+ results?$/)).toBeVisible();
});

test("a type word alone selects its chip and lists that kind", async ({ page }) => {
  await page.goto("/search?q=exercices");
  await expect(shown(page, /^Showing exercises · \d+ results?$/)).toBeVisible();
  await expect(chip(page, "Exercises")).toHaveAttribute("aria-current", "true");
  // "Solution" words filter the files while the chip stays All.
  await page.goto("/search?q=corrigé");
  await expect(shown(page, /^Showing solutions · \d+ results?$/)).toBeVisible();
  await expect(chip(page, "All")).toHaveAttribute("aria-current", "true");
  await expect(fileRows(page).first()).toContainText("Solution");
});

test("the chips narrow the results and live in the address", async ({ page }) => {
  await page.goto("/search?q=sample");
  await expect(section(page, "Courses")).toBeVisible();
  await expect(section(page, "Files")).toBeVisible();
  const chips = page.getByRole("navigation", { name: "Result types" });
  await expect(chips.getByRole("link")).toHaveText(["All", "Courses", "Lectures & notes", "Exercises", "Exams"]);
  await expect(chips.getByRole("link", { name: "All", exact: true })).toHaveAttribute("aria-current", "true");
  for (const link of await chips.getByRole("link").all()) {
    const box = await link.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(36);
  }

  await chips.getByRole("link", { name: "Exams", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=sample&type=exam$/);
  await expect(chips.getByRole("link", { name: "Exams", exact: true })).toHaveAttribute("aria-current", "true");
  await expect(section(page, "Files")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /^Courses/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: /^Chapters/ })).toHaveCount(0);
  for (const row of await fileRows(page).all()) await expect(row).toContainText("Exam");

  await chips.getByRole("link", { name: "Lectures & notes", exact: true }).click();
  await expect(page).toHaveURL(/type=lecture$/);
  for (const row of await fileRows(page).all()) await expect(row).toContainText(/Lecture|Notes/);

  await chips.getByRole("link", { name: "Courses", exact: true }).click();
  await expect(page).toHaveURL(/type=course$/);
  await expect(section(page, "Courses")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /^Files/ })).toHaveCount(0);

  await chips.getByRole("link", { name: "All", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=sample$/);
  await expect(section(page, "Files")).toBeVisible();
});

test("a section shows its top five and Show all expands it, 20 to a page", async ({ page }) => {
  await page.goto("/search?q=sample");
  await expect(fileRows(page)).toHaveCount(5);
  const showAll = page.getByRole("link", { name: /^Show all \d+ files$/ });
  const total = Number((await showAll.innerText()).match(/\d+/)![0]);
  expect(total).toBeGreaterThan(40);
  await expect(page.getByRole("heading", { level: 2, name: `Files · ${total}` })).toBeVisible();

  await showAll.click();
  await expect(page).toHaveURL(/\/search\?q=sample&show=files$/);
  await expect(fileRows(page)).toHaveCount(20);
  // The other sections give way, and the way back is a link.
  await expect(page.getByRole("heading", { level: 2, name: /^Courses/ })).toHaveCount(0);
  const pager = page.getByRole("navigation", { name: "Result pages" });
  await expect(pager).toContainText(`Page 1 of ${Math.ceil(total / 20)}`);
  const first = await fileRows(page).first().innerText();
  await pager.getByRole("link", { name: /next page/i }).click();
  await expect(page).toHaveURL(/show=files&page=2$/);
  await expect(pager).toContainText("Page 2 of");
  expect(await fileRows(page).first().innerText()).not.toBe(first);

  await page.getByRole("link", { name: /All results/ }).click();
  await expect(page).toHaveURL(/\/search\?q=sample$/);
  await expect(fileRows(page)).toHaveCount(5);
});

test("a file row shows its course, chapter, type, year and language and opens the reader", async ({ page }) => {
  await page.goto("/search?q=sample+exercise+sheet+1");
  const row = fileRows(page).filter({ hasText: "DEMO302" }).first();
  await expect(row).toContainText("Sample exercise sheet 1");
  await expect(row).toContainText("Chapter 1 · Exercise");
  await expect(row).toContainText("EN");
  await expect(row.getByRole("link", { name: /^Solution/ })).toHaveCount(1);
  await row.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/resources\/[0-9a-f-]{36}$/);
});

test("draft files are never found", async ({ page }) => {
  await page.goto("/search?q=draft");
  await expect(page.getByRole("heading", { level: 2, name: "No results for “draft”" })).toBeVisible();
});

test("no results: tips, a way to drop the chip, and two places to go on", async ({ page }) => {
  await page.goto("/search?q=zzqqxx&type=exercise");
  await expect(page.getByRole("heading", { level: 2, name: "No results for “zzqqxx”" })).toBeVisible();
  await expect(page.getByText("Search tips")).toBeVisible();
  await expect(page.getByText("Try a course code, like DEMO301")).toBeVisible();
  await expect(page.getByText("Use fewer words, or check the spelling")).toBeVisible();
  await expect(page.getByText("Accents and capitals don't matter")).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse courses" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: "Previous exams" })).toHaveAttribute("href", "/exams");

  await page.getByRole("link", { name: "Search all types instead of only Exercises" }).click();
  await expect(page).toHaveURL(/\/search\?q=zzqqxx&type=all$/);
  await expect(page.getByRole("heading", { level: 2, name: "No results for “zzqqxx”" })).toBeVisible();
  // No chip left to drop.
  await expect(page.getByRole("link", { name: /Search all types/ })).toHaveCount(0);
});

test("unusable address values are ignored, not errors", async ({ page }) => {
  const response = await page.goto("/search?q=demo301&type=nope&show=everything&page=-4");
  expect(response?.status()).toBe(200);
  await expect(section(page, "Courses")).toBeVisible();
  const long = await page.goto(`/search?q=${"x".repeat(300)}`);
  expect(long?.status()).toBe(200);
  await expect(shown(page, /No results for/)).toBeVisible();
});

test("text that looks like search syntax or markup is just text", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("<b>demo</b> & | ! ( ) ' \\")}`);
  await expect(page.getByRole("heading", { level: 1, name: "Search" })).toBeVisible();
  await expect(page.locator("main b")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: /No results|Courses|Files/ }).first()).toBeVisible();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the box is a form with a Search button that works", async ({ page }) => {
    await page.goto("/search");
    const box = page.getByRole("searchbox", { name: "Search courses, chapters and files" });
    await box.fill("demo301");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=demo301$/);
    await expect(section(page, "Courses").getByRole("link").first()).toContainText("DEMO301");
    await expect(page.getByRole("searchbox")).toHaveValue("demo301");
    // The chips are plain links.
    await chip(page, "Courses").click();
    await expect(page).toHaveURL(/q=demo301&type=course$/);
    await expect(section(page, "Courses")).toBeVisible();
    // The chip travels with the form.
    await page.getByRole("searchbox").fill("demo401");
    await page.getByRole("searchbox").press("Enter");
    await expect(page).toHaveURL(/q=demo401&type=course$/);
  });
});

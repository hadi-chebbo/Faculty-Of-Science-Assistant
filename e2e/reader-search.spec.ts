import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { samplePdf } from "../src/lib/storage/sample-pdf";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed (with STORAGE_DRIVER=local).
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the connection below fails with a clear error.
  }
}

const storageDir = () => path.resolve(process.env.STORAGE_LOCAL_DIR ?? ".storage");

// Two stored files and resources that point at them (in DEMO302, which no other test counts), removed
// afterwards. The first has a table of contents and words on given pages; the second has no outline.
const WITH_OUTLINE = 6;
const WITHOUT_OUTLINE = 4;

interface Fixture {
  id: string;
  key: string;
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

async function addFixture(title: string, bytes: Uint8Array): Promise<Fixture> {
  const key = `resources/${crypto.randomUUID()}.pdf`;
  const file = path.join(storageDir(), ...key.split("/"));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
  await fs.writeFile(`${file}.meta.json`, JSON.stringify({ contentType: "application/pdf" }));
  const id = await withDb(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO resources (course_id, type, title, language, file_key, is_published)
       SELECT id, 'lecture', $2, 'en', $1, true FROM courses WHERE code = 'DEMO302' RETURNING id`,
      [key, `${title} ${crypto.randomUUID().slice(0, 8)}`],
    );
    return rows[0].id as string;
  });
  return { id, key };
}

async function removeFixture({ id, key }: Fixture) {
  await withDb((client) => client.query("DELETE FROM resources WHERE id = $1", [id]));
  const file = path.join(storageDir(), ...key.split("/"));
  await fs.rm(file, { force: true });
  await fs.rm(`${file}.meta.json`, { force: true });
}

const bar = (page: Page) => page.getByRole("group", { name: "Page and zoom" });
const barElement = (page: Page) => page.locator('[role="group"][aria-label="Page and zoom"]');
const isPhone = (page: Page) => page.viewportSize()!.width < 768;

async function showBar(page: Page) {
  if (isPhone(page)) await barElement(page).dispatchEvent("pointerdown");
  await expect(bar(page)).toBeVisible();
}

async function expectPageNumber(page: Page, current: number, total: number) {
  await showBar(page);
  if (isPhone(page)) {
    await expect(bar(page)).toContainText(`${current} / ${total}`);
  } else {
    await expect(page.getByLabel("Page number")).toHaveValue(String(current));
  }
}

const searchBar = (page: Page) => page.getByRole("search");
const searchInput = (page: Page) => page.getByRole("searchbox", { name: "Find in document" });
const currentHit = (page: Page, n: number) => page.locator(`[data-page="${n}"] mark.reader-hit-current`);
const allHits = (page: Page) => page.locator("mark.reader-hit");

// How far below the top of the reading area (the box that scrolls on a wide screen, the bottom of the
// top row on a phone) the top of a page is. A page brought into view should sit a small gap below it.
async function pageTopGap(page: Page, number: number): Promise<number> {
  return page.locator(`[data-page="${number}"]`).evaluate((element) => {
    const area = element.closest(".overflow-auto");
    const top = area
      ? area.getBoundingClientRect().top
      : (document.querySelector("section[aria-label='Document'] > div")?.getBoundingClientRect().bottom ?? 0);
    return element.getBoundingClientRect().top - top;
  });
}

// The page top is where it should be, and stays there once the layout has settled.
async function expectPageAtTop(page: Page, number: number) {
  await expect.poll(() => pageTopGap(page, number), { timeout: 5000 }).toBeGreaterThanOrEqual(4);
  await expect.poll(() => pageTopGap(page, number)).toBeLessThanOrEqual(14);
  await page.waitForTimeout(1200);
  const gap = await pageTopGap(page, number);
  expect(gap).toBeGreaterThanOrEqual(4);
  expect(gap).toBeLessThanOrEqual(14);
}

async function openSearchWithButton(page: Page) {
  await page.getByRole("button", { name: "Search in document" }).click();
  await expect(searchInput(page)).toBeFocused();
}

async function search(page: Page, text: string) {
  await searchInput(page).fill(text);
}

test.describe("text, search and contents", () => {
  let withOutline: Fixture;
  let withoutOutline: Fixture;

  test.beforeAll(async () => {
    withOutline = await addFixture(
      "Reader search with outline",
      samplePdf(["SEARCH TEST", "Six pages"], WITH_OUTLINE, {
        pageLines: {
          2: ["relation alpha"],
          4: ["Relation beta", "café été"],
          6: ["relation gamma"],
        },
        outline: [
          { title: "1. Introduction", page: 1 },
          {
            title: "2. Sets",
            page: 3,
            children: [
              { title: "2.1 Definitions", page: 4 },
              { title: "2.2 Examples", page: 5 },
            ],
          },
          { title: "3. Proofs", page: 6 },
        ],
      }),
    );
    withoutOutline = await addFixture("Reader thumbnails", samplePdf(["THUMB TEST", "Four pages"], WITHOUT_OUTLINE));
  });

  test.afterAll(async () => {
    await removeFixture(withOutline);
    await removeFixture(withoutOutline);
  });

  async function open(page: Page, fixture = withOutline, pages = WITH_OUTLINE) {
    await page.goto(`/resources/${fixture.id}`);
    await expect(page.getByRole("img", { name: `Page 1 of ${pages}` })).toBeVisible();
    await expect(page.getByTestId("zoom-percent")).toBeVisible();
  }

  test.describe("the text layer", () => {
    test("holds the words of the page and can be selected and copied", async ({ page, isMobile }) => {
      await open(page);
      const layer = page.locator('[data-page="1"] .reader-text');
      await expect(layer).toContainText("SEARCH TEST - page 1");
      await expect(layer).toContainText("Six pages");
      // Not hidden from assistive technology: it is the page's text. The canvas keeps its own label.
      await expect(layer).not.toHaveAttribute("aria-hidden", /.*/);
      await expect(page.getByRole("img", { name: `Page 1 of ${WITH_OUTLINE}` })).toBeVisible();
      // The text is invisible (the canvas shows it) but selectable.
      const span = layer.locator("span", { hasText: "Six pages" });
      expect(await span.evaluate((el) => getComputedStyle(el).userSelect)).toBe("text");
      expect(await span.evaluate((el) => getComputedStyle(el).color)).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      // And it lies over the canvas, at the place the words are drawn.
      const canvasBox = (await page.getByRole("img", { name: `Page 1 of ${WITH_OUTLINE}` }).boundingBox())!;
      const spanBox = (await span.boundingBox())!;
      expect(spanBox.x).toBeGreaterThan(canvasBox.x);
      expect(spanBox.x + spanBox.width).toBeLessThan(canvasBox.x + canvasBox.width);
      expect(spanBox.y).toBeGreaterThan(canvasBox.y);
      expect(spanBox.y + spanBox.height).toBeLessThan(canvasBox.y + canvasBox.height);
      if (isMobile) return;
      await span.click({ clickCount: 3 });
      expect(await page.evaluate(() => window.getSelection()?.toString())).toContain("Six pages");
    });

    test("follows the zoom: the words stay on the words", async ({ page, isMobile }) => {
      test.skip(isMobile, "uses the zoom buttons of the desktop bar");
      await open(page);
      const layer = page.locator('[data-page="1"] .reader-text');
      const span = layer.locator("span", { hasText: "Six pages" });
      const canvas = page.getByRole("img", { name: `Page 1 of ${WITH_OUTLINE}` });
      const relative = async () => {
        const c = (await canvas.boundingBox())!;
        const s = (await span.boundingBox())!;
        return { x: (s.x - c.x) / c.width, y: (s.y - c.y) / c.height, w: s.width / c.width };
      };
      const before = await relative();
      await page.getByRole("button", { name: "Zoom in" }).click();
      await page.getByRole("button", { name: "Zoom in" }).click();
      await expect.poll(async () => (await canvas.boundingBox())!.width).toBeGreaterThan(900);
      await expect
        .poll(async () => Math.abs((await relative()).x - before.x) + Math.abs((await relative()).y - before.y) + Math.abs((await relative()).w - before.w))
        .toBeLessThan(0.01);
    });

    test("a page far from the screen has no text layer, and gets one when it comes near", async ({ page }) => {
      await open(page);
      await expect(page.locator('[data-page="6"] .reader-text span').first()).toHaveCount(0);
      await page.keyboard.press("End");
      await expect(page.locator('[data-page="6"] .reader-text')).toContainText("relation gamma");
      await expect(page.locator('[data-page="1"] .reader-text span').first()).toHaveCount(0);
    });

    test("a page without any text has nothing to select and raises no error", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
      // No text lines at all: like a scanned file, the page is only a picture.
      const scanned = await addFixture("Reader scanned", samplePdf([], 1));
      try {
        await open(page, scanned, 1);
        await expect(page.locator('[data-page="1"] .reader-text')).toBeAttached();
        await expect(page.locator('[data-page="1"] .reader-text span')).toHaveCount(0);
        await openSearchWithButton(page);
        await search(page, "anything");
        await expect(searchBar(page)).toContainText("No matches");
        expect(errors).toEqual([]);
      } finally {
        await removeFixture(scanned);
      }
    });
  });

  test.describe("search in the document", () => {
    test("every match is clearly visible on the page, not only present in the DOM", async ({ page }) => {
      await open(page);
      await openSearchWithButton(page);
      // "es" is twice on page 1 (TEST, pages): the current match and another one, both drawn.
      await search(page, "es");
      const other = page.locator("mark.reader-hit:not(.reader-hit-current)").first();
      await expect(other).toBeVisible();
      for (const mark of [currentHit(page, 1), other]) {
        await mark.scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);
        const box = (await mark.boundingBox())!;
        expect(box.width).toBeGreaterThan(5);
        expect(box.height).toBeGreaterThan(5);
        // What the reader sees: the lightest pixel well inside the mark is the page under it, and a
        // white page (blue 255) loses a lot of blue where a highlight is drawn over it.
        const inset = 2;
        const clip = { x: box.x + inset, y: box.y + inset, width: box.width - 2 * inset, height: box.height - 2 * inset };
        const shot = (await page.screenshot({ clip })).toString("base64");
        const { lightestBlue, darkestRed } = await page.evaluate(async (data) => {
          const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(bitmap, 0, 0);
          const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
          let lightestBlue = 0;
          let darkestRed = 255;
          for (let i = 0; i < pixels.length; i += 4) {
            darkestRed = Math.min(darkestRed, pixels[i]);
            lightestBlue = Math.max(lightestBlue, pixels[i + 2]);
          }
          return { lightestBlue, darkestRed };
        }, shot);
        expect(lightestBlue).toBeLessThan(180);
        // And the highlight does not cover the word: its black letters still show through it.
        expect(darkestRed).toBeLessThan(200);
      }
    });

    test("the button opens it, the count reads 1 of 3, and next and previous move between pages", async ({ page, isMobile }) => {
      await open(page);
      await expect(searchBar(page)).toHaveCount(0);
      await openSearchWithButton(page);
      await expect(page.getByRole("button", { name: "Search in document" })).toHaveAttribute("aria-expanded", "true");

      await search(page, "relation");
      await expect(searchBar(page)).toContainText("1 of 3");
      // The first match from page 1 on is on page 2; it is marked strongly and is in view.
      await expect(currentHit(page, 2)).toBeVisible();
      await expect(currentHit(page, 2)).toBeInViewport();
      await expectPageNumber(page, 2, WITH_OUTLINE);
      expect(await allHits(page).count()).toBeGreaterThanOrEqual(1);

      await page.getByRole("button", { name: "Next match" }).click();
      await expect(searchBar(page)).toContainText("2 of 3");
      await expect(currentHit(page, 4)).toBeInViewport();
      await expectPageNumber(page, 4, WITH_OUTLINE);
      // The match is near the middle of what is visible, not at an edge.
      const box = (await currentHit(page, 4).boundingBox())!;
      const view = page.viewportSize()!;
      expect(box.y).toBeGreaterThan(view.height * (isMobile ? 0.2 : 0.2));
      expect(box.y).toBeLessThan(view.height * 0.8);

      await page.getByRole("button", { name: "Next match" }).click();
      await expect(searchBar(page)).toContainText("3 of 3");
      await expect(currentHit(page, 6)).toBeInViewport();
      // Past the last: round to the first.
      await page.getByRole("button", { name: "Next match" }).click();
      await expect(searchBar(page)).toContainText("1 of 3");
      await expect(currentHit(page, 2)).toBeInViewport();
      await page.getByRole("button", { name: "Previous match" }).click();
      await expect(searchBar(page)).toContainText("3 of 3");
      await expect(currentHit(page, 6)).toBeInViewport();
    });

    test("Enter goes to the next match and Shift+Enter to the previous one", async ({ page }) => {
      await open(page);
      await openSearchWithButton(page);
      await search(page, "relation");
      await expect(searchBar(page)).toContainText("1 of 3");
      await searchInput(page).press("Enter");
      await expect(searchBar(page)).toContainText("2 of 3");
      await searchInput(page).press("Shift+Enter");
      await expect(searchBar(page)).toContainText("1 of 3");
    });

    test("is case-insensitive: the capital R on page 4 is found by a lower-case query", async ({ page }) => {
      await open(page);
      await openSearchWithButton(page);
      await search(page, "RELATION");
      await expect(searchBar(page)).toContainText("1 of 3");
      await page.getByRole("button", { name: "Next match" }).click();
      await expect(currentHit(page, 4)).toHaveText("Relation");
    });

    test("ete finds the accented été", async ({ page }) => {
      await open(page);
      await openSearchWithButton(page);
      await search(page, "ete");
      await expect(searchBar(page)).toContainText("1 of 1");
      await expect(currentHit(page, 4)).toHaveText("été");
      // The other way round as well.
      await search(page, "ÉTÉ");
      await expect(searchBar(page)).toContainText("1 of 1");
    });

    test("says No matches, with the match buttons off", async ({ page }) => {
      await open(page);
      await openSearchWithButton(page);
      await search(page, "zzzzqq");
      await expect(searchBar(page)).toContainText("No matches");
      await expect(page.getByRole("button", { name: "Next match" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Previous match" })).toBeDisabled();
      await expect(allHits(page)).toHaveCount(0);
    });

    test("the box is the site's input, with the count inside it", async ({ page }) => {
      await open(page);
      await openSearchWithButton(page);
      await expect(searchInput(page)).toHaveAttribute("data-slot", "input");
      await search(page, "relation");
      await expect(searchBar(page)).toContainText("1 of 3");
      const field = (await searchInput(page).boundingBox())!;
      const count = (await searchBar(page).locator("[aria-live]").boundingBox())!;
      expect(count.x).toBeGreaterThan(field.x);
      expect(count.x + count.width).toBeLessThanOrEqual(field.x + field.width);
    });

    test("announces only the count, politely", async ({ page }) => {
      await open(page);
      await openSearchWithButton(page);
      const live = searchBar(page).locator("[aria-live]");
      await expect(live).toHaveCount(1);
      await expect(live).toHaveAttribute("aria-live", "polite");
      await search(page, "relation");
      await expect(live).toHaveText("1 of 3");
    });

    test("Esc closes it and clears the highlights", async ({ page }) => {
      await open(page);
      await openSearchWithButton(page);
      await search(page, "relation");
      await expect(currentHit(page, 2)).toBeVisible();
      await searchInput(page).press("Escape");
      await expect(searchBar(page)).toHaveCount(0);
      await expect(allHits(page)).toHaveCount(0);
      // The text under the marks is back whole.
      await expect(page.locator('[data-page="2"] .reader-text')).toContainText("relation alpha");
      await expect(page.getByRole("button", { name: "Search in document" })).toBeFocused();
      // Opened again, it starts empty.
      await openSearchWithButton(page);
      await expect(searchInput(page)).toHaveValue("");
    });

    test("Esc with the focus on a bar button closes it and returns the focus to Search", async ({ page }) => {
      await open(page);
      for (const name of ["Next match", "Previous match", "Close search"]) {
        await openSearchWithButton(page);
        await search(page, "relation");
        await expect(searchBar(page)).toContainText("1 of 3");
        await page.getByRole("button", { name }).focus();
        await page.keyboard.press("Escape");
        await expect(searchBar(page), name).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Search in document" }), name).toBeFocused();
      }
    });

    test("the close button returns the focus to Search too", async ({ page }) => {
      await open(page);
      await openSearchWithButton(page);
      await page.getByRole("button", { name: "Close search" }).click();
      await expect(page.getByRole("button", { name: "Search in document" })).toBeFocused();
    });

    test("the close button closes it too", async ({ page }) => {
      await open(page);
      await openSearchWithButton(page);
      await search(page, "relation");
      await expect(currentHit(page, 2)).toBeVisible();
      await page.getByRole("button", { name: "Close search" }).click();
      await expect(searchBar(page)).toHaveCount(0);
      await expect(allHits(page)).toHaveCount(0);
    });

    test("Ctrl+F opens it and focuses the box, and pressing it again focuses it again", async ({ page, isMobile }) => {
      test.skip(isMobile, "needs a keyboard");
      await open(page);
      await page.keyboard.press("ControlOrMeta+f");
      await expect(searchInput(page)).toBeFocused();
      await search(page, "relation");
      await expect(searchBar(page)).toContainText("1 of 3");
      // Away from the box (the reader's own keys work again), then Ctrl+F once more.
      await page.getByRole("button", { name: "Zoom in" }).focus();
      await expect(searchInput(page)).not.toBeFocused();
      await page.keyboard.press("ControlOrMeta+f");
      await expect(searchInput(page)).toBeFocused();
      await expect(searchBar(page)).toHaveCount(1);
      // Esc with the focus outside the box closes it as well.
      await page.getByRole("button", { name: "Zoom in" }).focus();
      await page.keyboard.press("Escape");
      await expect(searchBar(page)).toHaveCount(0);
    });

    test("the highlights follow the zoom", async ({ page, isMobile }) => {
      test.skip(isMobile, "uses the zoom buttons of the desktop bar");
      await open(page);
      await openSearchWithButton(page);
      await search(page, "relation");
      const hit = currentHit(page, 2);
      await expect(hit).toBeVisible();
      const canvas = page.getByRole("img", { name: `Page 2 of ${WITH_OUTLINE}` });
      const relative = async () => {
        const c = (await canvas.boundingBox())!;
        const h = (await hit.boundingBox())!;
        return { x: (h.x - c.x) / c.width, y: (h.y - c.y) / c.height };
      };
      const before = await relative();
      await page.getByRole("button", { name: "Zoom in" }).click();
      await page.getByRole("button", { name: "Zoom in" }).click();
      await expect.poll(async () => (await canvas.boundingBox())!.width).toBeGreaterThan(900);
      await expect(hit).toBeVisible();
      await expect
        .poll(async () => {
          const now = await relative();
          return Math.abs(now.x - before.x) + Math.abs(now.y - before.y);
        })
        .toBeLessThan(0.01);
    });

    test("typing pauses before the search runs, and a changed query replaces the old highlights", async ({ page }) => {
      await open(page);
      await openSearchWithButton(page);
      await search(page, "alpha");
      await expect(searchBar(page)).toContainText("1 of 1");
      await expect(currentHit(page, 2)).toHaveText("alpha");
      await search(page, "gamma");
      await expect(searchBar(page)).toContainText("1 of 1");
      await expect(currentHit(page, 6)).toHaveText("gamma");
      await expect(page.locator('[data-page="2"] mark')).toHaveCount(0);
    });

    test("Ctrl+F is taken over: its default (the browser's find) is prevented", async ({ page, isMobile }) => {
      test.skip(isMobile, "needs a keyboard");
      await open(page);
      const prevented = await page.evaluate(() => {
        const event = new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true, cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      });
      expect(prevented).toBe(true);
    });
  });

  test.describe("the Contents panel", () => {
    const toggle = (page: Page) => page.getByRole("button", { name: "Contents", exact: true });

    test("lists the file's outline, nested, with page numbers, and jumps to the entry chosen", async ({ page, isMobile }) => {
      test.skip(isMobile, "phones open a sheet instead");
      await open(page);
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByRole("navigation", { name: "Contents" })).toHaveCount(0);
      await toggle(page).click();
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
      const nav = page.getByRole("navigation", { name: "Contents" });
      await expect(nav).toBeVisible();
      await expect(nav.getByRole("button")).toHaveText(["1. Introduction1", "2. Sets3", "2.1 Definitions4", "2.2 Examples5", "3. Proofs6"]);
      // Nesting: the sections sit further in than their chapter.
      const left = (name: string) => nav.getByRole("button", { name }).evaluate((el) => el.getBoundingClientRect().left + parseFloat(getComputedStyle(el).paddingLeft));
      expect(await left("2.1 Definitions 4")).toBeGreaterThan(await left("2. Sets 3"));
      // The entry for the page being read is marked.
      await expect(nav.getByRole("button", { name: /1\. Introduction/ })).toHaveAttribute("aria-current", "location");

      await nav.getByRole("button", { name: /2\.1 Definitions/ }).click();
      await expectPageNumber(page, 4, WITH_OUTLINE);
      await expect(page.getByRole("img", { name: `Page 4 of ${WITH_OUTLINE}` })).toBeInViewport();
      await expect(nav.getByRole("button", { name: /2\.1 Definitions/ })).toHaveAttribute("aria-current", "location");
      await expect(nav.locator("[aria-current]")).toHaveCount(1);
    });

    test("a jump right after opening the panel lands on the page's top, with its gap", async ({ page, isMobile }) => {
      test.skip(isMobile, "phones open a sheet instead");
      await open(page);
      await toggle(page).click();
      // At once, before the pages have been laid out for the narrower area.
      await page.getByRole("navigation", { name: "Contents" }).getByRole("button", { name: /2\.1 Definitions/ }).click();
      await expectPageAtTop(page, 4);
      // The same with thumbnails, and with the panel closing during the jump.
      await toggle(page).click();
      await expectPageAtTop(page, 4);
    });

    test("jumps by the page box and the arrows land on the page's top as well", async ({ page, isMobile }) => {
      test.skip(isMobile, "uses the desktop page box");
      await open(page);
      await page.getByRole("button", { name: "Next page" }).click();
      await expectPageAtTop(page, 2);
      const box = page.getByLabel("Page number");
      await box.fill("5");
      await box.press("Enter");
      await expectPageAtTop(page, 5);
    });

    test("when open, the toggle has a border, a tint and a bold label", async ({ page, isMobile }) => {
      test.skip(isMobile, "phones have an icon only");
      await open(page);
      await expect(toggle(page)).not.toHaveAttribute("aria-controls", /.+/);
      await toggle(page).click();
      await expect(toggle(page)).toHaveAttribute("aria-controls", "reader-contents");
      await expect(page.locator("#reader-contents")).toBeVisible();
      const style = () =>
        toggle(page).evaluate((el) => {
          const css = getComputedStyle(el);
          return { border: css.borderTopWidth, weight: Number(css.fontWeight), background: css.backgroundColor };
        });
      // (The button transitions its properties, so the weight takes a moment to arrive.)
      await expect.poll(async () => (await style()).weight).toBeGreaterThanOrEqual(600);
      expect((await style()).border).toBe("1px");
      expect((await style()).background).not.toBe("rgba(0, 0, 0, 0)");
    });

    test("narrows the reading area, and is remembered", async ({ page, isMobile }) => {
      test.skip(isMobile, "phones open a sheet instead");
      await open(page);
      const canvas = page.getByRole("img", { name: `Page 1 of ${WITH_OUTLINE}` });
      const area = page.locator('[data-page="1"]');
      const closedBox = (await area.boundingBox())!;
      const readingArea = page.locator("section[aria-label='Document']");
      const wide = (await readingArea.boundingBox())!;
      await toggle(page).click();
      await expect(page.getByRole("navigation", { name: "Contents" })).toBeVisible();
      const panel = (await page.locator("#reader-contents").boundingBox())!;
      expect(panel.width).toBeGreaterThan(180);
      expect(panel.width).toBeLessThan(230);
      // The page moves right by half the panel when it stays centred in a narrower area.
      await expect.poll(async () => (await area.boundingBox())!.x).not.toBe(closedBox.x);
      expect((await canvas.boundingBox())!.x).toBeGreaterThan(panel.x + panel.width);
      expect((await readingArea.boundingBox())!.width).toBe(wide.width);
      // Reloaded, it is still open; closed again, it stays closed.
      await page.reload();
      await expect(page.getByRole("img", { name: `Page 1 of ${WITH_OUTLINE}` })).toBeVisible();
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("navigation", { name: "Contents" })).toBeVisible();
      await toggle(page).click();
      await expect(page.getByRole("navigation", { name: "Contents" })).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole("img", { name: `Page 1 of ${WITH_OUTLINE}` })).toBeVisible();
      await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    });

    test("the entries can be reached and used with the keyboard", async ({ page, isMobile }) => {
      test.skip(isMobile, "needs a keyboard");
      await open(page);
      await toggle(page).focus();
      await page.keyboard.press("Enter");
      const nav = page.getByRole("navigation", { name: "Contents" });
      await expect(nav).toBeVisible();
      // The top row comes first (Search, More actions), then the entries in reading order.
      const entry = (name: RegExp) => nav.getByRole("button", { name });
      for (let i = 0; i < 4 && !(await entry(/1\. Introduction/).evaluate((el) => el === document.activeElement)); i++) {
        await page.keyboard.press("Tab");
      }
      await expect(entry(/1\. Introduction/)).toBeFocused();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await expect(entry(/2\.1 Definitions/)).toBeFocused();
      await page.keyboard.press("Enter");
      await expectPageNumber(page, 4, WITH_OUTLINE);
    });

    test("shows page thumbnails when the file has no outline, and jumps to the page chosen", async ({ page, isMobile }) => {
      test.skip(isMobile, "phones open a sheet instead");
      await open(page, withoutOutline, WITHOUT_OUTLINE);
      await toggle(page).click();
      const nav = page.getByRole("navigation", { name: "Contents" });
      await expect(nav.getByRole("button")).toHaveText(["Page 1", "Page 2", "Page 3", "Page 4"]);
      await expect(nav.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
      // A thumbnail is really drawn.
      const canvas = nav.getByRole("button", { name: "Page 1" }).locator("canvas");
      await expect
        .poll(() =>
          canvas.evaluate((element) => {
            const c = element as HTMLCanvasElement;
            if (c.width === 0) return false;
            const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
            for (let i = 0; i < data.length; i += 4) if (data[i] < 200) return true;
            return false;
          }),
        )
        .toBe(true);
      await nav.getByRole("button", { name: "Page 3" }).click();
      await expectPageNumber(page, 3, WITHOUT_OUTLINE);
      await expect(page.getByRole("img", { name: `Page 3 of ${WITHOUT_OUTLINE}` })).toBeInViewport();
      await expect(nav.getByRole("button", { name: "Page 3" })).toHaveAttribute("aria-current", "page");
      await expect(nav.locator("[aria-current]")).toHaveCount(1);
    });

    test("on a phone it is a sheet from the left that closes after choosing an entry", async ({ page, isMobile }) => {
      test.skip(!isMobile, "wide screens have a panel");
      await open(page);
      // Icon only: the label is for assistive technology.
      const button = toggle(page);
      await expect(button).toHaveText("");
      await button.click();
      const sheet = page.getByRole("dialog", { name: "Contents" });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole("button", { name: /3\. Proofs/ })).toBeVisible();
      await sheet.getByRole("button", { name: /2\.2 Examples/ }).click();
      await expect(sheet).toHaveCount(0);
      await expectPageNumber(page, 5, WITH_OUTLINE);
      await expect(page.getByRole("img", { name: `Page 5 of ${WITH_OUTLINE}` })).toBeInViewport();
      await expectPageAtTop(page, 5);
      // Reopened, the entry for the page now being read is marked.
      await button.click();
      await expect(page.getByRole("dialog", { name: "Contents" }).getByRole("button", { name: /2\.2 Examples/ })).toHaveAttribute("aria-current", "location");
    });

    test("on a phone the thumbnails are in the sheet", async ({ page, isMobile }) => {
      test.skip(!isMobile, "wide screens have a panel");
      await open(page, withoutOutline, WITHOUT_OUTLINE);
      await toggle(page).click();
      const sheet = page.getByRole("dialog", { name: "Contents" });
      await sheet.getByRole("button", { name: "Page 4" }).click();
      await expect(sheet).toHaveCount(0);
      await expectPageNumber(page, 4, WITHOUT_OUTLINE);
    });

    test("still works in focus mode", async ({ page, isMobile }) => {
      await open(page);
      await page.getByRole("button", { name: "More actions" }).click();
      await page.getByRole(isMobile ? "button" : "menuitem", { name: "Focus mode" }).click();
      await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
      await toggle(page).click();
      if (isMobile) {
        const sheet = page.getByRole("dialog", { name: "Contents" });
        await sheet.getByRole("button", { name: /3\. Proofs/ }).click();
      } else {
        await page.getByRole("navigation", { name: "Contents" }).getByRole("button", { name: /3\. Proofs/ }).click();
      }
      await expectPageNumber(page, 6, WITH_OUTLINE);
      // And search works there as well.
      await page.getByRole("button", { name: "Search in document" }).click();
      await search(page, "alpha");
      await expect(searchBar(page)).toContainText("1 of 1");
    });
  });

  test.describe("on a phone", () => {
    test.beforeEach(({ isMobile }) => {
      test.skip(!isMobile, "phone gestures");
    });

    async function hideBar(page: Page) {
      await page.clock.install();
      await open(page);
      await expect(bar(page)).toBeVisible();
      await page.clock.fastForward(5000);
      await expect(bar(page)).toBeHidden();
    }

    test("a short tap on the text still shows the bar, and a long press selects without touching it", async ({ page }) => {
      await hideBar(page);
      const view = page.viewportSize()!;
      const x = view.width / 2;
      const y = view.height * 0.45;

      // A long press: the finger rests for longer than a tap, so the bar stays as it was.
      const cdp = await page.context().newCDPSession(page);
      const touch = (type: "touchStart" | "touchEnd") =>
        cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
      await touch("touchStart");
      await page.waitForTimeout(600);
      await touch("touchEnd");
      await page.waitForTimeout(100);
      await expect(bar(page)).toBeHidden();

      // A short tap shows it.
      await page.touchscreen.tap(x, y);
      await expect(bar(page)).toBeVisible();
      await page.touchscreen.tap(x, y);
      await expect(bar(page)).toBeHidden();
    });

    test("search opens from the top row, takes the card's width, and its buttons are at least 40px", async ({ page }) => {
      await open(page);
      await openSearchWithButton(page);
      await search(page, "relation");
      await expect(searchBar(page)).toContainText("1 of 3");
      for (const name of ["Previous match", "Next match", "Close search"]) {
        const box = (await page.getByRole("button", { name }).boundingBox())!;
        expect(box.width, name).toBeGreaterThanOrEqual(40);
        expect(box.height, name).toBeGreaterThanOrEqual(40);
      }
      const row = (await searchBar(page).boundingBox())!;
      const card = (await page.locator("section[aria-label='Document']").boundingBox())!;
      expect(row.width).toBeGreaterThanOrEqual(card.width - 2);
      // It sits right under the top row, which stays on screen with it.
      await page.getByRole("button", { name: "Next match" }).click();
      await expect(currentHit(page, 4)).toBeInViewport();
      const top = (await page.getByRole("button", { name: "Search in document" }).boundingBox())!;
      expect(top.y).toBeGreaterThanOrEqual(0);
      expect(top.y).toBeLessThan(200);
    });

    test("the top row holds only Contents, Search and More actions", async ({ page }) => {
      await open(page);
      const row = page.locator("section[aria-label='Document'] > div").first();
      await expect(row.getByRole("button")).toHaveCount(3);
      await expect(row.getByRole("button")).toHaveText(["", "", ""]);
    });
  });

  test("the top row of a wide screen holds only Contents, Search and More actions", async ({ page, isMobile }) => {
    test.skip(isMobile, "the phone has its own check");
    await open(page);
    const row = page.locator("section[aria-label='Document'] > div").first();
    await expect(row.getByRole("button")).toHaveCount(3);
    await expect(row.getByRole("button").nth(0)).toHaveText("Contents");
    await expect(row.getByRole("button").nth(1)).toHaveAccessibleName("Search in document");
    await expect(row.getByRole("button").nth(2)).toHaveAccessibleName("More actions");
  });
});

import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { ZOOM_LEVELS } from "../src/app/(site)/resources/[id]/reader-zoom";
import { samplePdf } from "../src/lib/storage/sample-pdf";

// Needs the demo data: SEED_DEMO_DATA=true npm run db:seed (with STORAGE_DRIVER=local).
// Locally the URL lives in .env, which Next.js loads for the server but not for this process.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the connection below fails with a clear error.
  }
}

const UNKNOWN_ID = "33333333-3333-4333-8333-333333333333";
const HTML = { Accept: "text/html,application/xhtml+xml,*/*;q=0.8" };

const MENU_BUTTON = "More actions";

async function openMenu(page: Page) {
  await page.getByRole("button", { name: MENU_BUTTON }).click();
}

// Desktop: a dropdown whose entries are menu items. Phone: a bottom sheet of buttons and links.
function menuEntry(page: Page, isMobile: boolean, name: string | RegExp, link = false) {
  return page.getByRole(isMobile ? (link ? "link" : "button") : "menuitem", { name });
}

// Desktop: a box you can type into. Phone: plain text.
async function expectPageNumber(page: Page, isMobile: boolean, current: number, total: number) {
  if (isMobile) {
    await expect(page.getByRole("group", { name: "Page and zoom" })).toContainText(`${current} / ${total}`);
  } else {
    await expect(page.getByLabel("Page number")).toHaveValue(String(current));
    await expect(page.getByRole("group", { name: "Page and zoom" })).toContainText(`/ ${total}`);
  }
}

// On a phone the bar hides itself while reading and a tap on the pages brings it back; on desktop it
// is always there. These reveal it before a test uses it.
const bar = (page: Page) => page.getByRole("group", { name: "Page and zoom" });
// The same element found without the accessibility tree, which leaves it out while it is hidden.
const barElement = (page: Page) => page.locator('[role="group"][aria-label="Page and zoom"]');
const isPhone = (page: Page) => page.viewportSize()!.width < 768;

async function tapPage(page: Page) {
  const view = page.viewportSize()!;
  await page.touchscreen.tap(view.width / 2, view.height * 0.45);
}

// Always reveals the bar with a full delay ahead of it, so a test never depends on how long ago it
// was shown: a press on the bar (dispatched, so it also works while the bar is hidden or fading)
// shows it and restarts its timer, exactly as a real press on it does.
// Waits for a smooth scroll to come to rest. Needed before a fast-forward of the page's clock,
// which would otherwise run the reader's "scroll is over" timer while the scroll is still moving.
async function scrollRest(page: Page) {
  let last = -1;
  await expect
    .poll(async () => {
      const y = await page.evaluate(() => window.scrollY);
      const rest = y === last;
      last = y;
      return rest;
    })
    .toBe(true);
}

async function showBar(page: Page) {
  if (isPhone(page)) await barElement(page).dispatchEvent("pointerdown");
  await expect(bar(page)).toBeVisible();
}

const zoomPercent = async (page: Page) => Number.parseInt((await page.getByTestId("zoom-percent").textContent()) ?? "", 10);
const canvasWidth = async (page: Page, number: number, total: number) =>
  (await page.getByRole("img", { name: `Page ${number} of ${total}` }).boundingBox())!.width;

async function resourceId(courseCode: string, title: string): Promise<string> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT r.id FROM resources r JOIN courses c ON c.id = r.course_id
       WHERE c.code = $1 AND r.title = $2`,
      [courseCode, title],
    );
    expect(rows).toHaveLength(1);
    return rows[0].id;
  } finally {
    await client.end();
  }
}

test.describe("the reader page", () => {
  test("a course page row opens it in the same tab", async ({ page }) => {
    const id = await resourceId("DEMO401", "Sample lecture 1");
    await page.goto("/courses/DEMO401");
    await page.getByRole("link", { name: /Sample lecture 1/ }).click();
    await expect(page).toHaveURL(new RegExp(`/resources/${id}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Sample lecture 1" })).toBeVisible();
  });

  test("shows the title, a drawn page and the page counter", async ({ page, isMobile }) => {
    const id = await resourceId("DEMO301", "Sample lecture 1");
    await page.goto(`/resources/${id}`);
    await expect(page).toHaveTitle("Sample lecture 1 (DEMO301) | University Assistant");
    await expect(page.getByRole("heading", { level: 1, name: "Sample lecture 1" })).toBeVisible();
    await expect(page.getByText("Lecture · English")).toBeVisible();

    const canvas = page.getByRole("img", { name: "Page 1 of 1" });
    await expect(canvas).toBeVisible();
    // The page was really drawn: the canvas has pixels and not all of them are white.
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
    await expectPageNumber(page, isMobile, 1, 1);
    // The details are on the page as well.
    await expect(page.getByText("Details", { exact: true })).toBeVisible();
  });

  test("Download answers with an attachment named after the title, and the bytes are a PDF", async ({ page, request, isMobile }) => {
    const id = await resourceId("DEMO301", "Sample lecture 1");
    await page.goto(`/resources/${id}`);
    await openMenu(page);
    const download = menuEntry(page, isMobile, "Download", true);
    await expect(download).toHaveAttribute("href", `/api/v1/resources/${id}/download`);

    const response = await request.get(`/api/v1/resources/${id}/download`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["cache-control"]).toBe("no-store");
    const served = await request.get(response.headers()["location"]);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-disposition"]).toBe(`attachment; filename="Sample lecture 1.pdf"; filename*=UTF-8''Sample%20lecture%201.pdf`);
    expect((await served.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  test("Open outside the reader is a plain link to the open route, in a new tab", async ({ page, isMobile }) => {
    const id = await resourceId("DEMO301", "Sample lecture 1");
    await page.goto(`/resources/${id}`);
    await openMenu(page);
    const link = menuEntry(page, isMobile, /Open outside the reader/, true);
    await expect(link).toHaveAttribute("href", `/api/v1/resources/${id}/open`);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });

  test("a draft and an unknown id show the 404 page", async ({ page }) => {
    const draft = await resourceId("DEMO501", "Sample draft lecture");
    for (const id of [draft, UNKNOWN_ID, "not-a-uuid"]) {
      // The page streams (like the other public pages), so the 404 page replaces the skeleton.
      await page.goto(`/resources/${id}`);
      await expect(page.getByRole("heading", { name: "Page not found" }), id).toBeVisible();
      await expect(page.getByRole("img", { name: /^Page 1 of/ })).toHaveCount(0);
    }
  });

  test("a solution link goes to the solution's reader page", async ({ page }) => {
    const exam = await resourceId("DEMO301", "Sample partial exam 2023");
    const solution = await resourceId("DEMO301", "Sample partial exam 2023 solution");
    await page.goto(`/resources/${exam}`);
    await expect(page.getByRole("img", { name: "Page 1 of 1" })).toBeVisible();
    // The page is reused for the solution: its viewer must load the solution's own file, not keep
    // showing the exam's document.
    const solutionFile = page.waitForRequest((r) => r.url().endsWith(`/api/v1/resources/${solution}/open`));
    await page.getByRole("link", { name: /Solution: Sample partial exam 2023 solution/ }).click();
    await expect(page).toHaveURL(new RegExp(`/resources/${solution}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Sample partial exam 2023 solution" })).toBeVisible();
    await solutionFile;
    await expect(page.getByRole("img", { name: "Page 1 of 1" })).toBeVisible();
    // And back from the solution to its exam.
    await page.getByRole("link", { name: /Solution of: Sample partial exam 2023$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/resources/${exam}$`));
  });

  test("following a solution link never draws from the closed document", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    const exam = await resourceId("DEMO301", "Sample partial exam 2023");
    const solution = await resourceId("DEMO301", "Sample partial exam 2023 solution");
    await page.goto(`/resources/${exam}`);
    await expect(page.getByRole("img", { name: "Page 1 of 1" })).toBeVisible();
    // The solution's file is slow, so the old viewer is on screen for a while after its document
    // was closed; a zoom then asks every drawn page to draw again.
    await page.route(`**/api/v1/resources/${solution}/open`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });
    await page.getByRole("link", { name: /Solution: Sample partial exam 2023 solution/ }).click();
    await expect(page).toHaveURL(new RegExp(`/resources/${solution}$`));
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(150);
      await page.keyboard.press("+");
      await page.setViewportSize({ width: 700 - i * 40, height: 800 });
    }
    await expect(page.getByRole("img", { name: "Page 1 of 1" })).toBeVisible();
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test("shows a message with the actions when the file cannot be loaded", async ({ page }) => {
    const id = await resourceId("DEMO301", "Sample lecture 1");
    await page.route(`**/api/v1/resources/${id}/open`, (route) => route.fulfill({ status: 500, body: "nope" }));
    await page.goto(`/resources/${id}`);
    await expect(page.getByText("The file could not be shown here.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    // Beside the message.
    const alert = page.getByRole("alert");
    await expect(alert.getByRole("link", { name: "Download" })).toBeVisible();
    await expect(alert.getByRole("link", { name: /Open outside/ })).toBeVisible();

    // Once the file is reachable again, Try again shows it.
    await page.unroute(`**/api/v1/resources/${id}/open`);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("img", { name: "Page 1 of 1" })).toBeVisible();
  });

  test.describe("where back leads", () => {
    const cases = [
      { name: "an exam", course: "DEMO301", title: "Sample partial exam 2023", href: "/courses/DEMO301?tab=exams", area: "Previous exams" },
      { name: "a resource of a chapter", course: "DEMO301", title: "Sample lecture 2", href: "/courses/DEMO301/chapters/2", area: "Chapter 2" },
      { name: "material with no chapter in a course with chapters", course: "DEMO501", title: "Sample notes", href: "/courses/DEMO501?tab=other", area: "Other material" },
      { name: "a resource of a course without chapters", course: "DEMO401", title: "Sample lecture 1", href: "/courses/DEMO401", area: null },
    ];
    for (const c of cases) {
      test(`${c.name}: breadcrumb on desktop, back link on phones`, async ({ page, isMobile }) => {
        await page.goto(`/resources/${await resourceId(c.course, c.title)}`);
        if (isMobile) {
          const back = page.getByRole("link", { name: new RegExp(`^Back to ${c.course}`) });
          await expect(back).toHaveAttribute("href", c.href);
          await expect(back).toHaveText(c.course);
        } else {
          const trail = page.getByRole("navigation", { name: "breadcrumb" });
          await expect(trail.getByRole("link", { name: c.course, exact: true })).toHaveAttribute("href", `/courses/${c.course}`);
          if (c.area) await expect(trail.getByRole("link", { name: c.area, exact: true })).toHaveAttribute("href", c.href);
          await expect(trail.getByText(c.title, { exact: true })).toBeVisible();
        }
      });
    }
  });
});

// The seed files have one page, so these tests store a 12-page file and a resource that points at it
// (in DEMO302, which no other test counts), and remove both afterwards.
const PAGES = 12;
const storageDir = () => path.resolve(process.env.STORAGE_LOCAL_DIR ?? ".storage");

test.describe("reading a long file", () => {
  let id = "";
  let key = "";

  async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      return await run(client);
    } finally {
      await client.end();
    }
  }

  test.beforeAll(async () => {
    key = `resources/${crypto.randomUUID()}.pdf`;
    const file = path.join(storageDir(), ...key.split("/"));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, samplePdf(["READER TEST", "Twelve pages"], PAGES));
    await fs.writeFile(`${file}.meta.json`, JSON.stringify({ contentType: "application/pdf" }));
    id = await withDb(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO resources (course_id, type, title, language, file_key, is_published)
         SELECT id, 'lecture', $2, 'en', $1, true FROM courses WHERE code = 'DEMO302' RETURNING id`,
        [key, `Reader test twelve pages ${crypto.randomUUID().slice(0, 8)}`],
      );
      return rows[0].id as string;
    });
  });

  test.afterAll(async () => {
    await withDb((client) => client.query("DELETE FROM resources WHERE id = $1", [id]));
    const file = path.join(storageDir(), ...key.split("/"));
    await fs.rm(file, { force: true });
    await fs.rm(`${file}.meta.json`, { force: true });
  });

  async function open(page: Page) {
    await page.goto(`/resources/${id}`);
    await expect(page.getByRole("img", { name: `Page 1 of ${PAGES}` })).toBeVisible();
    await expect(page.getByTestId("zoom-percent")).toBeVisible();
    await showBar(page);
  }

  const pageCanvas = (page: Page, n: number) => page.getByRole("img", { name: `Page ${n} of ${PAGES}` });

  test("next and previous move through the pages and stop at the start", async ({ page, isMobile }) => {
    await open(page);
    await expectPageNumber(page, isMobile, 1, PAGES);
    await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
    await showBar(page);
    await page.getByRole("button", { name: "Next page" }).click();
    await expectPageNumber(page, isMobile, 2, PAGES);
    await expect(pageCanvas(page, 2)).toBeInViewport();
    await showBar(page);
    await page.getByRole("button", { name: "Next page" }).click();
    await expectPageNumber(page, isMobile, 3, PAGES);
    await showBar(page);
    await page.getByRole("button", { name: "Previous page" }).click();
    await expectPageNumber(page, isMobile, 2, PAGES);
    await expect(page.getByRole("button", { name: "Previous page" })).toBeEnabled();
  });

  test("the page box jumps to a typed page and ignores nonsense", async ({ page, isMobile }) => {
    test.skip(isMobile, "phones show the page number as text");
    await open(page);
    const box = page.getByLabel("Page number");
    await box.fill("5");
    await box.press("Enter");
    await expectPageNumber(page, false, 5, PAGES);
    await expect(pageCanvas(page, 5)).toBeInViewport();
    for (const bad of ["99", "0", "abc", ""]) {
      await box.fill(bad);
      await box.press("Enter");
      await expect(box, bad).toHaveValue("5");
    }
    // Leaving the box jumps as well.
    await box.fill("8");
    await page.getByRole("button", { name: "Next page" }).focus();
    await expectPageNumber(page, false, 8, PAGES);
    await expect(pageCanvas(page, 8)).toBeInViewport();
  });

  test("the keys move between pages and change the zoom", async ({ page, isMobile }) => {
    await open(page);
    await page.keyboard.press("End");
    await expectPageNumber(page, isMobile, PAGES, PAGES);
    await expect(pageCanvas(page, PAGES)).toBeInViewport();
    await page.keyboard.press("Home");
    await expectPageNumber(page, isMobile, 1, PAGES);
    await page.keyboard.press("ArrowRight");
    await expectPageNumber(page, isMobile, 2, PAGES);
    await page.keyboard.press("PageDown");
    await expectPageNumber(page, isMobile, 3, PAGES);
    await page.keyboard.press("ArrowLeft");
    await expectPageNumber(page, isMobile, 2, PAGES);
    await page.keyboard.press("PageUp");
    await expectPageNumber(page, isMobile, 1, PAGES);

    const fit = await zoomPercent(page);
    await page.keyboard.press("+");
    await expect.poll(() => zoomPercent(page)).toBeGreaterThan(fit);
    await page.keyboard.press("=");
    await expect.poll(() => zoomPercent(page)).toBeGreaterThan(fit + 10);
    const zoomed = await zoomPercent(page);
    await page.keyboard.press("-");
    await expect.poll(() => zoomPercent(page)).toBeLessThan(zoomed);
    await page.keyboard.press("0");
    await expect.poll(() => zoomPercent(page)).toBe(fit);
  });

  test("the keys do nothing while typing in the page box", async ({ page, isMobile }) => {
    test.skip(isMobile, "phones have no page box");
    await open(page);
    const fit = await zoomPercent(page);
    const box = page.getByLabel("Page number");
    // Start from an empty box: what End does to a selection differs by platform (it moves the
    // caret on Linux, not on macOS), and the box's starting text is not what this test is about.
    await box.fill("");
    // The keys go into the box (the "+" is typed there), not to the reader.
    await page.keyboard.press("End");
    await page.keyboard.press("+");
    await expect(box).toHaveValue("+");
    expect(await zoomPercent(page)).toBe(fit);
    await expect(pageCanvas(page, 1)).toBeInViewport();  });

  test("zoom in and out change the percentage and the size of the pages", async ({ page }) => {
    await open(page);
    const fit = await zoomPercent(page);
    const fitWidth = await canvasWidth(page, 1, PAGES);

    await showBar(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    const bigger = await zoomPercent(page);
    expect(bigger).toBe(ZOOM_LEVELS.find((level) => level > fit + 0.5));
    await expect.poll(() => canvasWidth(page, 1, PAGES)).toBeGreaterThan(fitWidth);
    expect((await canvasWidth(page, 1, PAGES)) / fitWidth).toBeCloseTo(bigger / fit, 1);

    // Two steps up, then one down: smaller than the second step (a phone starts below 50%, where
    // there is no way down).
    await showBar(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    const biggest = await zoomPercent(page);
    const biggestWidth = await canvasWidth(page, 1, PAGES);
    await showBar(page);
    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect.poll(() => zoomPercent(page)).toBeLessThan(biggest);
    await expect.poll(() => canvasWidth(page, 1, PAGES)).toBeLessThan(biggestWidth);

    // The page is drawn again at the new size.
    await expect.poll(() => pageCanvas(page, 1).evaluate((element) => (element as HTMLCanvasElement).width > 0)).toBe(true);
  });

  test("zoom keeps the reader on the same page, and a wide page scrolls sideways", async ({ page, isMobile }) => {
    await open(page);
    for (let i = 0; i < 3; i++) {
      await showBar(page);
      await page.getByRole("button", { name: "Next page" }).click();
    }
    await expectPageNumber(page, isMobile, 4, PAGES);
    await expect(pageCanvas(page, 4)).toBeInViewport();
    // Let the smooth scroll to page 4 come to rest before zooming.
    let last = -1;
    await expect
      .poll(async () => {
        const top = (await pageCanvas(page, 4).boundingBox())!.y;
        const rest = top === last;
        last = top;
        return rest;
      })
      .toBe(true);
    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    for (let i = 0; i < 12 && (await zoomIn.isEnabled()); i++) {
      const before = await zoomPercent(page);
      await showBar(page);
      await zoomIn.click();
      await expect.poll(() => zoomPercent(page)).toBeGreaterThan(before);
    }
    await expect.poll(() => zoomPercent(page)).toBe(300);
    expect(await canvasWidth(page, 4, PAGES)).toBeGreaterThan(page.viewportSize()!.width);
    await expectPageNumber(page, isMobile, 4, PAGES);
    await expect(pageCanvas(page, 4)).toBeInViewport();
    // Something in the card scrolls sideways.
    const sideways = await page
      .getByRole("region", { name: "Document" })
      .evaluate((card) =>
        Array.from(card.querySelectorAll("div")).some((d) => d.scrollWidth > d.clientWidth + 8 && getComputedStyle(d).overflowX !== "visible"),
      );
    expect(sideways).toBe(true);
  });

  test("fit page shows a whole page where fit width does not", async ({ page, isMobile }) => {
    test.skip(isMobile, "on a phone both fits give the same size for an A4 page");
    await open(page);
    const widthPercent = await zoomPercent(page);
    const card = (await page.getByRole("region", { name: "Document" }).boundingBox())!;
    expect((await pageCanvas(page, 1).boundingBox())!.height).toBeGreaterThan(card.height);

    await openMenu(page);
    await menuEntry(page, false, "Fit page").click();
    await expect.poll(() => zoomPercent(page)).toBeLessThan(widthPercent);
    await expect.poll(async () => (await pageCanvas(page, 1).boundingBox())!.height).toBeLessThan(card.height);

    await openMenu(page);
    await menuEntry(page, false, "Fit width").click();
    await expect.poll(() => zoomPercent(page)).toBe(widthPercent);
  });

  test("the menu has Fit, Focus mode, Download and Open outside the reader", async ({ page, isMobile }) => {
    await open(page);
    await openMenu(page);
    for (const name of ["Fit width", "Fit page", "Focus mode"]) await expect(menuEntry(page, isMobile, name)).toBeVisible();
    const download = menuEntry(page, isMobile, "Download", true);
    await expect(download).toHaveAttribute("href", `/api/v1/resources/${id}/download`);
    const outside = menuEntry(page, isMobile, /Open outside the reader/, true);
    await expect(outside).toHaveAttribute("href", `/api/v1/resources/${id}/open`);
    await expect(outside).toHaveAttribute("target", "_blank");
    await expect(outside).toHaveAttribute("rel", /noopener/);
    await page.keyboard.press("Escape");
    await expect(download).toHaveCount(0);
    // The old toolbar buttons are gone from the title area.
    await expect(page.getByRole("link", { name: "Download" })).toHaveCount(0);
  });

  test("focus mode covers the viewport and Esc leaves it", async ({ page, isMobile }) => {
    await open(page);
    const card = page.getByRole("region", { name: "Document" });
    const normal = (await card.boundingBox())!;
    await openMenu(page);
    await menuEntry(page, isMobile, "Focus mode").click();

    await expect
      .poll(async () => {
        const box = (await card.boundingBox())!;
        const view = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
        return [box.x, box.y, Math.round(box.width), Math.round(box.height)].join() === [0, 0, view.w, view.h].join();
      })
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
    // Desktop: the bar is there on entering focus mode without any tap.
    if (!isMobile) await expect(bar(page)).toBeVisible();
    await showBar(page);
    await expect(page.getByRole("button", { name: MENU_BUTTON })).toBeVisible();

    await openMenu(page);
    await expect(menuEntry(page, isMobile, "Exit focus mode")).toBeVisible();
    // The first Esc closes the menu, the second leaves focus mode.
    await page.keyboard.press("Escape");
    await expect(menuEntry(page, isMobile, "Exit focus mode")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect.poll(async () => Math.round((await card.boundingBox())!.width)).toBe(Math.round(normal.width));
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
    await expect(page.getByRole("button", { name: MENU_BUTTON })).toBeFocused();
  });

  test("in focus mode Tab stays inside the card", async ({ page, isMobile }) => {
    await open(page);
    await openMenu(page);
    await menuEntry(page, isMobile, "Focus mode").click();
    await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
    const outside = () =>
      page.evaluate(() => {
        const active = document.activeElement;
        if (active === null || active === document.body || active.closest('section[aria-label="Document"]')) return false;
        return `${active.tagName} ${active.id} ${(active.getAttribute("aria-label") ?? active.textContent ?? "").slice(0, 40)}`;
      });
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      expect(await outside(), `after Tab ${i + 1}`).toBe(false);
    }
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(await outside(), `after Shift+Tab ${i + 1}`).toBe(false);
    }
    // The menu still works, and everything behind is reachable again afterwards.
    await openMenu(page);
    await menuEntry(page, isMobile, "Exit focus mode").click();
    await expect.poll(() => page.evaluate(() => document.querySelectorAll("[inert]").length)).toBe(0);
  });

  test("focus mode can be left from the menu", async ({ page, isMobile }) => {
    await open(page);
    await openMenu(page);
    await menuEntry(page, isMobile, "Focus mode").click();
    await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
    await openMenu(page);
    await menuEntry(page, isMobile, "Exit focus mode").click();
    await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe("");
    await expect(page.getByRole("button", { name: MENU_BUTTON })).toBeFocused();
  });

  test("offers to continue where the reader left off, once", async ({ page, isMobile }) => {
    await open(page);
    await expect(page.getByRole("region", { name: "Continue reading" })).toHaveCount(0);
    await showBar(page);
    await page.getByRole("button", { name: "Next page" }).click();
    await expectPageNumber(page, isMobile, 2, PAGES);
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), `reader:last-page:${id}`)).toBe("2");

    await page.reload();
    const notice = page.getByRole("region", { name: "Continue reading" });
    await expect(notice).toContainText("Continue where you left off, page 2?");
    await notice.getByRole("button", { name: "Go" }).click();
    await expect(notice).toHaveCount(0);
    await expectPageNumber(page, isMobile, 2, PAGES);
    await expect(pageCanvas(page, 2)).toBeInViewport();

    // Dismissing hides it without moving.
    await page.reload();
    await expect(notice).toBeVisible();
    await notice.getByRole("button", { name: "Dismiss" }).click();
    await expect(notice).toHaveCount(0);
    await expectPageNumber(page, isMobile, 1, PAGES);
  });

  test("Enter in the page box jumps once", async ({ page, isMobile }) => {
    test.skip(isMobile, "phones have no page box");
    await page.addInitScript(() => {
      (window as unknown as { jumps: number }).jumps = 0;
      const original = Element.prototype.scrollBy;
      Element.prototype.scrollBy = function (this: Element, ...args: unknown[]) {
        (window as unknown as { jumps: number }).jumps++;
        return (original as (...a: unknown[]) => void).apply(this, args);
      } as typeof Element.prototype.scrollBy;
    });
    await open(page);
    const box = page.getByLabel("Page number");
    await box.fill("6");
    await box.press("Enter");
    await expectPageNumber(page, false, 6, PAGES);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as unknown as { jumps: number }).jumps)).toBe(1);
  });

  test("the arrow keys scroll sideways while the page is wider than the area", async ({ page, isMobile }) => {
    await open(page);
    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    for (let i = 0; i < 12 && (await zoomIn.isEnabled()); i++) {
      await showBar(page);
      await zoomIn.click();
    }
    await expect.poll(() => zoomPercent(page)).toBe(300);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    await expectPageNumber(page, isMobile, 1, PAGES);
    // Page keys and Home/End still move between pages.
    await page.keyboard.press("PageDown");
    await expectPageNumber(page, isMobile, 2, PAGES);
    await page.keyboard.press("0");
    await page.keyboard.press("ArrowRight");
    await expectPageNumber(page, isMobile, 3, PAGES);
  });

  test("the place is saved when leaving by an in-app link straight away", async ({ page, isMobile }) => {
    await open(page);
    await showBar(page);
    await page.getByRole("button", { name: "Next page" }).click();
    await expectPageNumber(page, isMobile, 2, PAGES);
    const toCourse = isMobile
      ? page.getByRole("link", { name: /^Back to DEMO302/ })
      : page.getByRole("navigation", { name: "breadcrumb" }).getByRole("link", { name: "DEMO302", exact: true });
    await toCourse.click();
    await expect(page).toHaveURL(/\/courses\/DEMO302/);
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), `reader:last-page:${id}`)).toBe("2");
  });

  test("keeps working when the browser's storage throws", async ({ page, isMobile }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    });
    await open(page);
    await showBar(page);
    await page.getByRole("button", { name: "Next page" }).click();
    await expectPageNumber(page, isMobile, 2, PAGES);
    await page.waitForTimeout(800);
    await expect(page.getByRole("region", { name: "Continue reading" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test.describe("the bar on a phone", () => {
    test.beforeEach(({ isMobile }) => {
      test.skip(!isMobile, "the bar hides itself only on a phone");
    });

    // Time is controlled by the page's clock, so the delays are skipped instead of waited for.
    async function openWithClock(page: Page) {
      await page.clock.install();
      await page.goto(`/resources/${id}`);
      await expect(page.getByRole("img", { name: `Page 1 of ${PAGES}` })).toBeVisible();
      await expect(bar(page)).toBeVisible();
    }

    test("shows at first, hides by itself, and a tap shows it and a second tap hides it", async ({ page }) => {
      await openWithClock(page);
      await page.clock.fastForward(5000);
      await expect(bar(page)).toBeHidden();
      // Hidden means out of reach: not focusable, not hit by a press, not in the accessibility tree.
      expect(await barElement(page).evaluate((el) => getComputedStyle(el).visibility)).toBe("hidden");
      await expect(page.getByRole("button", { name: "Next page" })).toHaveCount(0);

      await tapPage(page);
      await expect(bar(page)).toBeVisible();
      await tapPage(page);
      await expect(bar(page)).toBeHidden();
    });

    test("a tap on the page shows the bar, and it hides again after the delay", async ({ page }) => {
      await openWithClock(page);
      await page.clock.fastForward(5000);
      await expect(bar(page)).toBeHidden();
      await tapPage(page);
      await expect(bar(page)).toBeVisible();
      await page.clock.fastForward(3500);
      await expect(bar(page)).toBeVisible();
      await page.clock.fastForward(1000);
      await expect(bar(page)).toBeHidden();
    });

    test("scrolling the page does not show it", async ({ page }) => {
      await openWithClock(page);
      await page.clock.fastForward(5000);
      await expect(bar(page)).toBeHidden();

      await page.mouse.wheel(0, 500);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
      await expect(bar(page)).toBeHidden();

      // A finger dragged over the page is a scroll, not a tap.
      const cdp = await page.context().newCDPSession(page);
      const x = page.viewportSize()!.width / 2;
      const touch = (type: "touchStart" | "touchMove" | "touchEnd", y: number) =>
        cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
      await touch("touchStart", 500);
      for (let y = 500; y >= 380; y -= 20) await touch("touchMove", y);
      await touch("touchEnd", 380);
      await expect(bar(page)).toBeHidden();
    });

    test("using the bar keeps it visible, and it hides again after the delay", async ({ page }) => {
      await openWithClock(page);
      await page.clock.fastForward(5000);
      await tapPage(page);
      await expect(bar(page)).toBeVisible();

      await page.clock.fastForward(3000);
      await page.getByRole("button", { name: "Next page" }).click();
      await expectPageNumber(page, true, 2, PAGES);
      await scrollRest(page);
      // 3 s + 3 s later: past the delay from the tap, but not from the click.
      await page.clock.fastForward(3000);
      await expect(bar(page)).toBeVisible();
      await page.getByRole("button", { name: "Previous page" }).click();
      await expectPageNumber(page, true, 1, PAGES);
      await scrollRest(page);

      await page.clock.fastForward(5000);
      await expect(bar(page)).toBeHidden();
    });

    test("stays while the More actions sheet is open", async ({ page }) => {
      await openWithClock(page);
      const visibility = () => barElement(page).evaluate((el) => getComputedStyle(el).visibility);
      await openMenu(page);
      await page.clock.fastForward(10_000);
      expect(await visibility()).toBe("visible");
      await page.keyboard.press("Escape");
      await expect(menuEntry(page, true, "Focus mode")).toHaveCount(0);
      expect(await visibility()).toBe("visible");
      await page.clock.fastForward(5000);
      await expect(bar(page)).toBeHidden();
    });

    test("Tab from the top row reveals it and the focus stays inside", async ({ page }) => {
      await openWithClock(page);
      await page.clock.fastForward(5000);
      await expect(bar(page)).toBeHidden();
      await page.getByRole("button", { name: MENU_BUTTON }).focus();
      await page.keyboard.press("Tab");
      await expect(bar(page)).toBeVisible();
      // The reading area itself may come first in the tab order (it scrolls sideways).
      const next = page.getByRole("button", { name: "Next page" });
      for (let i = 0; i < 2 && !(await next.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
      await expect(next).toBeFocused();
      // Held open while the focus is inside.
      await page.clock.fastForward(10_000);
      await expect(bar(page)).toBeVisible();
    });

    test("works the same in focus mode", async ({ page }) => {
      await openWithClock(page);
      await openMenu(page);
      await menuEntry(page, true, "Focus mode").click();
      await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
      await page.clock.fastForward(10_000);
      await expect(bar(page)).toBeHidden();
      await tapPage(page);
      await expect(bar(page)).toBeVisible();
    });
  });

  test("on a wide screen the bar never hides", async ({ page, isMobile }) => {
    test.skip(isMobile, "phones hide the bar");
    await page.clock.install();
    await page.goto(`/resources/${id}`);
    await expect(bar(page)).toBeVisible();
    await page.clock.fastForward(30_000);
    await expect(bar(page)).toBeVisible();
    // A click on the pages does not toggle it either.
    // (The page's text layer lies over its canvas now, so the click is made on the page itself.)
    await page.locator('[data-page="1"]').click({ position: { x: 20, y: 20 } });
    await expect(bar(page)).toBeVisible();
  });
});

test.describe("GET /api/v1/resources/[id]/download", () => {
  test("answers 404 for a draft, an unknown id and a malformed id, uncached", async ({ request }) => {
    const draft = await resourceId("DEMO501", "Sample draft lecture");
    for (const id of [draft, UNKNOWN_ID, "not-a-uuid"]) {
      const response = await request.get(`/api/v1/resources/${id}/download`, { maxRedirects: 0 });
      expect(response.status(), id).toBe(404);
      expect(response.headers()["cache-control"]).toBe("no-store");
      expect(response.headers()["location"]).toBeUndefined();
    }
  });

  test("sends a browser to the friendly page when it fails", async ({ request }) => {
    for (const id of [UNKNOWN_ID, "not-a-uuid"]) {
      const response = await request.get(`/api/v1/resources/${id}/download`, { maxRedirects: 0, headers: HTML });
      expect(response.status(), id).toBe(307);
      expect(response.headers()["location"]).toBe("/resource-unavailable");
      expect(response.headers()["cache-control"]).toBe("no-store");
    }
  });
});

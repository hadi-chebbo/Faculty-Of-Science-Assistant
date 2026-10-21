import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { parseStorageConfig } from "../src/lib/storage/config";

// Needs the demo data, an admin and the local storage driver (the files are written straight into
// the local storage folder, which this spec refuses to run without). The driver follows the app's
// own rule (parseStorageConfig): STORAGE_DRIVER, else r2 on Vercel and local elsewhere. It creates its own files under
// fresh resources/<uuid>.pdf keys and removes them in a finally block. Desktop project only.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: CI passes the variables in the environment.
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
function storageConfig() {
  try {
    return parseStorageConfig(process.env);
  } catch {
    return undefined; // invalid or incomplete config: beforeAll reports it
  }
}

// The same folder the server uses (STORAGE_LOCAL_DIR, default .storage, from the repo root).
const STORAGE_DIR = storageConfig()?.localDir ?? path.resolve(".storage");

test.beforeAll(({}, testInfo) => {
  if (testInfo.project.name === "mobile") return; // skipped below; nothing to check
  expect(ADMIN_EMAIL && ADMIN_PASSWORD, "ADMIN_EMAIL and ADMIN_PASSWORD must be set").toBeTruthy();
  expect(
    storageConfig()?.driver,
    "the app would use R2 here (STORAGE_DRIVER=r2, or VERCEL set); set STORAGE_DRIVER=local so no test file is written to R2",
  ).toBe("local");
});

async function query<T>(sql: string): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql)).rows as T[];
  } finally {
    await client.end();
  }
}

const octet = () => randomBytes(1)[0];
const fileOf = (key: string) => path.join(STORAGE_DIR, ...key.split("/"));
const exists = (key: string) => fs.stat(fileOf(key)).then(() => true, () => false);

async function put(key: string, ageDays: number) {
  await fs.mkdir(path.dirname(fileOf(key)), { recursive: true });
  await fs.writeFile(fileOf(key), "%PDF-1.4\n%%EOF\n");
  const when = new Date(Date.now() - ageDays * 86_400_000);
  await fs.utimes(fileOf(key), when, when);
}

async function signInAsAdmin(page: Page) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin$/);
}

test.describe("admin storage page", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "writes files; desktop only");

  test("scans, lists only the abandoned file, deletes it after confirming", async ({ page }) => {
    const abandoned = `resources/${randomUUID()}.pdf`;
    const young = `resources/${randomUUID()}.pdf`;
    // A seeded file that a published resource uses, made old so only the reference protects it.
    const [used] = await query<{ file_key: string }>("SELECT file_key FROM resources WHERE file_key LIKE 'resources/%' LIMIT 1");
    expect(used, "the demo seed has a stored file").toBeTruthy();
    try {
      await put(abandoned, 2);
      await put(young, 0);
      if (await exists(used.file_key)) {
        const old = new Date(Date.now() - 3 * 86_400_000);
        await fs.utimes(fileOf(used.file_key), old, old);
      }

      await signInAsAdmin(page);
      await page.getByRole("link", { name: "Storage" }).click();
      await expect(page.getByRole("heading", { name: "Storage", level: 1 })).toBeVisible();
      await expect(page.getByText("Files in storage that no resource uses, older than 24 hours.")).toBeVisible();

      await page.getByRole("link", { name: "Scan storage" }).click();
      await expect(page).toHaveURL(/scan=1/);
      const list = page.getByRole("list", { name: "Abandoned files" });
      await expect(list.locator(`[title="${abandoned}"]`)).toBeVisible();
      await expect(list.locator(`[title="${young}"]`)).toHaveCount(0);
      await expect(list.locator(`[title="${used.file_key}"]`)).toHaveCount(0);
      await expect(page.getByText(/\d+ abandoned files? · /)).toBeVisible();

      await page.getByRole("button", { name: /^Delete \d+ files?$/ }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog.getByText("This cannot be undone.", { exact: false })).toBeVisible();
      await dialog.getByRole("button", { name: "Delete", exact: true }).click();

      await expect(page.getByText(/^Deleted 1 file\./)).toBeVisible();
      await expect(page.getByText("No abandoned files.")).toBeVisible();
      expect(await exists(abandoned)).toBe(false);
      expect(await exists(young)).toBe(true);
      if (await exists(used.file_key)) expect(await exists(used.file_key)).toBe(true);
    } finally {
      await fs.rm(fileOf(abandoned), { force: true });
      await fs.rm(`${fileOf(abandoned)}.meta.json`, { force: true });
      await fs.rm(fileOf(young), { force: true });
    }
  });
});

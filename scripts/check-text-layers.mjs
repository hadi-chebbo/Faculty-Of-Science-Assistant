// Backfill of the text check for PDFs that were stored before the check existed (or with --all, to
// check every stored PDF again). For each resource with a file it reads the file through
// src/lib/storage, counts the pages that have text with PDF.js (the same function the admin's
// browser uses at upload) and writes page_count and text_page_count.
//
//   npm run text-layers:check -- [--all] [--dry-run] [--allow-r2]
//
// It prints the storage driver and the database host first. With STORAGE_DRIVER=r2 it refuses to run
// without --allow-r2, because it then reads the real bucket and writes the real database.
// Failures (a damaged or encrypted PDF, a missing file) leave the row untouched and are counted.
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error("text-layers:check needs Node 22.18 or newer (built-in TypeScript support).");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const known = new Set(["--all", "--dry-run", "--allow-r2"]);
for (const arg of args) {
  if (!known.has(arg)) {
    console.error(`Unknown option ${arg}. Options: --all, --dry-run, --allow-r2`);
    process.exit(1);
  }
}
const all = args.has("--all");
const dryRun = args.has("--dry-run");

// The sources are TypeScript with "@/" imports and extension-less relative imports.
const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? pathToFileURL(path.join(src, specifier.slice(2))).href : specifier;
    const candidates = /\.[a-z]+$/.test(target) ? [target] : [target, `${target}.ts`, `${target}/index.ts`];
    let failure;
    for (const candidate of candidates) {
      try {
        return nextResolve(candidate, context);
      } catch (error) {
        failure = error;
      }
    }
    throw failure;
  },
});

const { getStorage, getStorageConfig } = await import("../src/lib/storage/config.ts");
const { checkTextLayer, textLayerStatus } = await import("../src/lib/pdf-text-check.ts");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { default: pg } = await import("pg");

const driver = getStorageConfig().driver;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const host = new URL(databaseUrl);
console.log(`Storage driver: ${driver}`);
console.log(`Database: ${host.hostname}${host.port ? `:${host.port}` : ""}${host.pathname}`);
console.log(`Mode: ${dryRun ? "dry run (nothing is written)" : "writes page_count and text_page_count"}, ${all ? "every stored PDF" : "files not checked yet"}`);
if (driver === "r2" && !args.has("--allow-r2")) {
  console.error("Refusing to run: STORAGE_DRIVER=r2 reads the real bucket. Add --allow-r2 if that is what you want.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === "false" || /localhost|127\.0\.0\.1/.test(host.hostname) ? false : { rejectUnauthorized: false } });
await client.connect();
const storage = getStorage();
const tally = { checked: 0, scanned: 0, partial: 0, text: 0, failed: 0 };

try {
  const { rows } = await client.query(
    `SELECT id, title, file_key FROM resources WHERE file_key IS NOT NULL ${all ? "" : "AND page_count IS NULL"} ORDER BY created_at, id`,
  );
  console.log(`${rows.length} file${rows.length === 1 ? "" : "s"} to check.`);
  for (const row of rows) {
    const label = `${row.id} (${row.title})`;
    let task;
    try {
      const bytes = await storage.read(row.file_key);
      if (!bytes) throw new Error("the stored file is missing");
      task = getDocument({ data: bytes, verbosity: 0 });
      const { pageCount, textPageCount } = await checkTextLayer(await task.promise);
      if (pageCount < 1) throw new Error("the PDF has no pages");
      const status = textLayerStatus(pageCount, textPageCount);
      tally.checked++;
      tally[status]++;
      console.log(`${status.padEnd(8)} ${textPageCount}/${pageCount} ${label}`);
      if (!dryRun) {
        await client.query("UPDATE resources SET page_count = $1, text_page_count = $2 WHERE id = $3", [pageCount, textPageCount, row.id]);
      }
    } catch (error) {
      tally.failed++;
      console.log(`failed   ${label}: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      await task?.destroy().catch(() => {});
    }
  }
} finally {
  await client.end();
}
console.log(`Checked ${tally.checked}: ${tally.scanned} scanned, ${tally.partial} partly scanned, ${tally.text} with text. Failed ${tally.failed}.${dryRun ? " (dry run: nothing written)" : ""}`);

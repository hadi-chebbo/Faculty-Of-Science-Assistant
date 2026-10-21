// Manual check of the R2 storage driver against a real bucket. Run by the owner:
//   STORAGE_DRIVER=r2 plus the four R2_* variables in .env, then: npm run storage:check
// It writes two small objects under test/ and deletes them again. It prints one line per step
// and never a secret or a signed URL. Nothing runs in CI or in the automated tests.
//
// The driver is TypeScript, so this script uses Node's built-in type stripping (native since
// Node 22.18) and a small hook that lets the driver's extension-less relative imports resolve.
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error("storage:check needs Node 22.18 or newer (built-in TypeScript support).");
  process.exit(1);
}
if (process.env.STORAGE_DRIVER !== "r2") {
  console.error("Refusing to run: set STORAGE_DRIVER=r2 explicitly (this check talks to a real bucket).");
  process.exit(1);
}
const names = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
const missing = names.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing: ${missing.join(", ")}`);
  process.exit(1);
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});
const { createR2Storage } = await import("../src/lib/storage/r2.ts");

const storage = createR2Storage({
  accountId: process.env.R2_ACCOUNT_ID,
  bucket: process.env.R2_BUCKET,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
});

const id = randomUUID();
const directKey = `test/check-${id}.pdf`;
const ticketKey = `test/check-${id}-upload.pdf`;
const body = new TextEncoder().encode("%PDF-1.7\nstorage check\n");
let failed = false;

async function step(label, run) {
  try {
    const detail = await run();
    console.log(`OK    ${label}${detail ? ` (${detail})` : ""}`);
    return true;
  } catch (error) {
    failed = true;
    console.log(`FAIL  ${label}: ${error instanceof Error ? error.message : "unknown error"}`);
    return false;
  }
}
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
const status = (response) => expect(response.ok, `HTTP ${response.status}`);

try {
  await step("put", () => storage.put(directKey, body, "application/pdf"));
  await step("stat", async () => {
    const info = await storage.stat(directKey);
    expect(info !== null, "object not found");
    expect(info.size === body.length, `size ${info.size}, expected ${body.length}`);
    expect(info.contentType === "application/pdf", `content type ${info.contentType}`);
  });
  await step("readStart", async () => {
    const start = await storage.readStart(directKey, 5);
    expect(start !== null && new TextDecoder().decode(start) === "%PDF-", "unexpected first bytes");
  });
  await step("list", async () => {
    const listed = await storage.list("test/");
    const found = listed.find((file) => file.key === directKey);
    expect(found !== undefined, "object not listed");
    expect(found.size === body.length, `listed size ${found.size}`);
    expect(Number.isFinite(found.lastModified.getTime()), "listed time is not a date");
  });
  await step("read URL", async () => {
    const url = await storage.createReadUrl(directKey, { expiresInSeconds: 60, disposition: "inline" });
    const response = await fetch(url);
    status(response);
    expect((await response.arrayBuffer()).byteLength === body.length, "unexpected length");
    expect(response.headers.get("content-type") === "application/pdf", "unexpected content type");
  });
  await step("upload URL", async () => {
    const ticket = await storage.createUploadUrl(ticketKey, {
      contentType: "application/pdf",
      maxBytes: 1024,
      expiresInSeconds: 60,
    });
    status(await fetch(ticket.url, { method: ticket.method, headers: ticket.headers, body }));
    const info = await storage.stat(ticketKey);
    expect(info !== null && info.size === body.length, "uploaded object not found");
  });
  await step("upload URL refuses another content type", async () => {
    const ticket = await storage.createUploadUrl(ticketKey, {
      contentType: "application/pdf",
      maxBytes: 1024,
      expiresInSeconds: 60,
    });
    const response = await fetch(ticket.url, { method: "PUT", headers: { "Content-Type": "text/plain" }, body });
    expect(!response.ok, "R2 accepted a different content type");
  });
} finally {
  await step("delete", async () => {
    await storage.delete(directKey);
    await storage.delete(ticketKey);
  });
  await step("objects are gone", async () => {
    expect((await storage.stat(directKey)) === null, "first object still exists");
    expect((await storage.stat(ticketKey)) === null, "second object still exists");
  });
}

console.log(failed ? "Storage check FAILED." : "Storage check passed.");
process.exit(failed ? 1 : 0);

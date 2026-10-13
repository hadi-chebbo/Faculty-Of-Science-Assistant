import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getStorage } from "@/lib/storage/config";
import { signStorageToken } from "@/lib/storage/token";
import { GET, PUT } from "./route";

const ORIGIN = "http://localhost";
const PDF = "application/pdf";
let dir: string;

beforeAll(async () => {
  process.env.AUTH_SECRET = "storage-test-secret-0123456789abcdef0123";
  delete process.env.STORAGE_DRIVER;
  delete process.env.VERCEL;
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "ua-route-"));
  process.env.STORAGE_LOCAL_DIR = dir;
});
afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const upload = async (key: string, body: Uint8Array, maxBytes = 100, contentType = PDF) => {
  const target = await getStorage().createUploadUrl(key, { contentType, maxBytes, expiresInSeconds: 60 });
  return PUT(new Request(ORIGIN + target.url, { method: "PUT", headers: target.headers, body: body as BodyInit }));
};
const read = (url: string) => GET(new Request(ORIGIN + url));
const bytes = new TextEncoder().encode("%PDF-1.7 content");

describe("local storage route", () => {
  it("uploads through the signed URL and reads the same bytes back", async () => {
    expect((await upload("resources/r1.pdf", bytes)).status).toBe(204);
    const inline = await read(
      await getStorage().createReadUrl("resources/r1.pdf", { expiresInSeconds: 60, disposition: "inline" }),
    );
    expect(inline.status).toBe(200);
    expect(new Uint8Array(await inline.arrayBuffer())).toEqual(bytes);
    expect(inline.headers.get("content-type")).toBe(PDF);
    expect(inline.headers.get("content-length")).toBe(String(bytes.length));
    expect(inline.headers.get("content-disposition")).toBe("inline");
    expect(inline.headers.get("x-content-type-options")).toBe("nosniff");
    expect(inline.headers.get("cache-control")).toBe("no-store");
  });

  it("downloads under a sanitised filename", async () => {
    await upload("resources/r2.pdf", bytes);
    const url = await getStorage().createReadUrl("resources/r2.pdf", {
      expiresInSeconds: 60,
      disposition: "attachment",
      filename: 'a"b/c\r\n.pdf',
    });
    const res = await read(url);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="abc.pdf"');
    const fallback = await getStorage().createReadUrl("resources/r2.pdf", {
      expiresInSeconds: 60,
      disposition: "attachment",
    });
    expect((await read(fallback)).headers.get("content-disposition")).toBe('attachment; filename="file.pdf"');
  });

  it("answers 415 for a different content type", async () => {
    const target = await getStorage().createUploadUrl("resources/r3.pdf", {
      contentType: PDF,
      maxBytes: 100,
      expiresInSeconds: 60,
    });
    const res = await PUT(
      new Request(ORIGIN + target.url, { method: "PUT", headers: { "Content-Type": "text/html" }, body: bytes }),
    );
    expect(res.status).toBe(415);
    expect(await getStorage().stat("resources/r3.pdf")).toBeNull();
  });

  it("answers 413 for a body one byte over the limit and keeps nothing", async () => {
    expect((await upload("resources/r4.pdf", new Uint8Array(11), 10)).status).toBe(413);
    expect(await getStorage().stat("resources/r4.pdf")).toBeNull();
    expect((await upload("resources/r5.pdf", new Uint8Array(10), 10)).status).toBe(204);
  });

  it("answers 403 for a missing or bad token", async () => {
    expect((await PUT(new Request(`${ORIGIN}/x`, { method: "PUT", body: bytes }))).status).toBe(403);
    expect((await PUT(new Request(`${ORIGIN}/x?token=garbage`, { method: "PUT", body: bytes }))).status).toBe(403);
    expect((await GET(new Request(`${ORIGIN}/x`))).status).toBe(403);
    expect((await GET(new Request(`${ORIGIN}/x?token=garbage`))).status).toBe(403);
  });

  it("answers 403 when the token is for the other operation", async () => {
    const getToken = await signStorageToken(
      { op: "get", key: "resources/r6.pdf", disposition: "inline" },
      60,
    );
    const putToken = await signStorageToken(
      { op: "put", key: "resources/r6.pdf", contentType: PDF, maxBytes: 100 },
      60,
    );
    const putRes = await PUT(
      new Request(`${ORIGIN}/x?token=${getToken}`, { method: "PUT", headers: { "Content-Type": PDF }, body: bytes }),
    );
    expect(putRes.status).toBe(403);
    expect((await GET(new Request(`${ORIGIN}/x?token=${putToken}`))).status).toBe(403);
  });

  it("answers 404 for a missing file", async () => {
    const url = await getStorage().createReadUrl("resources/missing.pdf", {
      expiresInSeconds: 60,
      disposition: "inline",
    });
    expect((await read(url)).status).toBe(404);
  });

  it("answers 404 when the driver is not local", async () => {
    const url = await getStorage().createReadUrl("resources/r1.pdf", { expiresInSeconds: 60, disposition: "inline" });
    process.env.STORAGE_DRIVER = "r2";
    try {
      expect((await read(url)).status).toBe(404);
      expect((await PUT(new Request(ORIGIN + url, { method: "PUT", body: bytes }))).status).toBe(404);
    } finally {
      delete process.env.STORAGE_DRIVER;
    }
  });
});

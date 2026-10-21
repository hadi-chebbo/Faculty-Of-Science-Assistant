import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLocalStorage } from "./local";
import type { FileStorage } from "./types";

let base: string;
let dir: string;
let storage: FileStorage;
const bytes = (text: string) => new TextEncoder().encode(text);

beforeAll(async () => {
  base = await fs.mkdtemp(path.join(os.tmpdir(), "ua-local-"));
  dir = path.join(base, "store");
  storage = createLocalStorage(dir);
});
afterAll(async () => {
  await fs.rm(base, { recursive: true, force: true });
});

describe("local driver", () => {
  it("stores a file and reports its size and type", async () => {
    await storage.put("resources/a.pdf", bytes("%PDF-1.7 hello"), "application/pdf");
    expect(await storage.stat("resources/a.pdf")).toEqual({ size: 14, contentType: "application/pdf" });
    expect(Buffer.from((await storage.readStart("resources/a.pdf", 5))!).toString()).toBe("%PDF-");
  });

  it("returns fewer bytes for a short file", async () => {
    await storage.put("short.pdf", bytes("abc"), "application/pdf");
    expect((await storage.readStart("short.pdf", 100))!.length).toBe(3);
  });

  it("returns null for a missing file", async () => {
    expect(await storage.stat("nope.pdf")).toBeNull();
    expect(await storage.readStart("nope.pdf", 5)).toBeNull();
  });

  it("deletes a file, and a missing file quietly", async () => {
    await storage.put("gone.pdf", bytes("x"), "application/pdf");
    await storage.delete("gone.pdf");
    expect(await storage.stat("gone.pdf")).toBeNull();
    await expect(storage.delete("gone.pdf")).resolves.toBeUndefined();
  });

  it("leaves no temporary files behind", async () => {
    await storage.put("clean.pdf", bytes("x"), "application/pdf");
    expect((await fs.readdir(dir)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("lists the files under a prefix with size and modified time, without sidecars", async () => {
    await storage.put("lister/one.pdf", bytes("12345"), "application/pdf");
    await storage.put("lister/sub/two.pdf", bytes("1"), "application/pdf");
    await storage.put("other/three.pdf", bytes("1"), "application/pdf");
    const old = new Date("2026-01-01T00:00:00.000Z");
    await fs.utimes(path.join(dir, "lister", "one.pdf"), old, old);
    const listed = (await storage.list("lister/")).sort((a, b) => a.key.localeCompare(b.key));
    expect(listed.map((f) => f.key)).toEqual(["lister/one.pdf", "lister/sub/two.pdf"]);
    expect(listed[0].size).toBe(5);
    expect(listed[0].lastModified.getTime()).toBe(old.getTime());
    expect(await storage.list("nothing-here/")).toEqual([]);
    await expect(storage.list("../")).rejects.toThrow();
  });

  it("rejects an invalid key in every method, before touching the disk", async () => {
    const bad = "../escape.pdf";
    const url = { expiresInSeconds: 60, disposition: "inline" as const };
    await expect(storage.put(bad, bytes("x"), "application/pdf")).rejects.toThrow();
    await expect(storage.stat(bad)).rejects.toThrow();
    await expect(storage.readStart(bad, 5)).rejects.toThrow();
    await expect(storage.delete(bad)).rejects.toThrow();
    await expect(storage.createReadUrl(bad, url)).rejects.toThrow();
    await expect(
      storage.createUploadUrl(bad, { contentType: "application/pdf", maxBytes: 10, expiresInSeconds: 60 }),
    ).rejects.toThrow();
    expect((await fs.readdir(base)).sort()).toEqual(["store"]);
  });
});

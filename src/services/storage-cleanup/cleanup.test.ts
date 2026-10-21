import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { getStorage } from "@/lib/storage/config";
import { newResourceFileKey } from "@/lib/storage/keys";
import { ForbiddenError, ValidationError } from "../errors";
import type { Viewer } from "../viewer";
import { deleteAbandonedUploads, findAbandonedUploads } from "./cleanup";

let dir: string;
const NOW = new Date("2026-10-21T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000);

// getStorage() keeps the driver it first built, so one folder serves the whole file and is emptied per test.
beforeAll(async () => {
  delete process.env.VERCEL;
  process.env.STORAGE_DRIVER = "local";
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "ua-cleanup-"));
  process.env.STORAGE_LOCAL_DIR = dir;
});

beforeEach(async () => {
  await truncateAllTables();
  await fs.rm(dir, { recursive: true, force: true });
});

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
  await closeDb();
});

async function store(key: string, ageHours: number, size = 10) {
  const storage = getStorage();
  await storage.put(key, new Uint8Array(size), "application/pdf");
  const when = hoursAgo(ageHours);
  await fs.utimes(path.join(dir, key), when, when);
}
const exists = async (key: string) => (await getStorage().stat(key)) !== null;

async function setup() {
  const { User, Course, Resource } = getDb();
  const admin = await User.create({ email: "admin@example.com", passwordHash: "x", role: "admin" });
  const student = await User.create({ email: "student@example.com", passwordHash: "x", role: "student" });
  const course = await Course.create({ code: "TEST301", title: "Course", semester: 3 });
  return {
    admin: { id: admin.id, role: admin.role } as Viewer,
    student: { id: student.id, role: student.role } as Viewer,
    useKey: (key: string, published = false) =>
      Resource.create({ courseId: course.id, type: "lecture", title: "R", language: "en", fileKey: key, isPublished: published }),
  };
}

describe("storage cleanup", () => {
  it("finds only old, unused files with a generated key shape, oldest first", async () => {
    const f = await setup();
    const older = newResourceFileKey();
    const old = newResourceFileKey();
    const young = newResourceFileKey();
    const usedDraft = newResourceFileKey();
    const usedPublished = newResourceFileKey();
    await store(old, 48, 5);
    await store(older, 240, 7);
    await store(young, 23);
    await store(usedDraft, 100);
    await store(usedPublished, 100);
    await store("resources/not-a-uuid.pdf", 100);
    await store("other/11111111-1111-4111-8111-111111111111.pdf", 100);
    await f.useKey(usedDraft, false);
    await f.useKey(usedPublished, true);

    const found = await findAbandonedUploads(f.admin, NOW);
    expect(found.files.map((file) => file.key)).toEqual([older, old]);
    expect(found.totalBytes).toBe(12);
    expect(found.files[0].lastModified.getTime()).toBe(hoursAgo(240).getTime());
  });

  it("deletes the abandoned keys it is given and nothing else", async () => {
    const f = await setup();
    const a = newResourceFileKey();
    const b = newResourceFileKey();
    await store(a, 48);
    await store(b, 48);
    const result = await deleteAbandonedUploads(f.admin, [a], NOW);
    expect(result).toEqual({ deleted: [a], skipped: [] });
    expect(await exists(a)).toBe(false);
    expect(await exists(b)).toBe(true);
  });

  it("skips keys that are referenced, young, missing or of the wrong shape", async () => {
    const f = await setup();
    const used = newResourceFileKey();
    const young = newResourceFileKey();
    const missing = newResourceFileKey();
    await store(used, 48);
    await store(young, 1);
    await store("resources/not-a-uuid.pdf", 48);
    await f.useKey(used);
    const keys = [used, young, missing, "resources/not-a-uuid.pdf", "../etc/passwd"];
    const result = await deleteAbandonedUploads(f.admin, keys, NOW);
    expect(result.deleted).toEqual([]);
    expect(result.skipped.sort()).toEqual([...keys].sort());
    expect(await exists(used)).toBe(true);
    expect(await exists(young)).toBe(true);
    expect(await exists("resources/not-a-uuid.pdf")).toBe(true);
  });

  it("skips a key that was saved on a resource between the scan and the delete", async () => {
    const f = await setup();
    const key = newResourceFileKey();
    await store(key, 48);
    expect((await findAbandonedUploads(f.admin, NOW)).files.map((file) => file.key)).toEqual([key]);
    await f.useKey(key, true);
    expect(await deleteAbandonedUploads(f.admin, [key], NOW)).toEqual({ deleted: [], skipped: [key] });
    expect(await exists(key)).toBe(true);
  });

  it("reports a failed delete as skipped and continues", async () => {
    const f = await setup();
    const bad = newResourceFileKey();
    const good = newResourceFileKey();
    await store(bad, 48);
    await store(good, 48);
    const storage = getStorage();
    const original = storage.delete;
    storage.delete = async (key) => {
      if (key === bad) throw new Error("boom");
      return original(key);
    };
    try {
      const result = await deleteAbandonedUploads(f.admin, [bad, good], NOW);
      expect(result).toEqual({ deleted: [good], skipped: [bad] });
    } finally {
      storage.delete = original;
    }
  });

  it("validates the keys", async () => {
    const f = await setup();
    await expect(deleteAbandonedUploads(f.admin, [], NOW)).rejects.toBeInstanceOf(ValidationError);
    await expect(deleteAbandonedUploads(f.admin, Array.from({ length: 501 }, newResourceFileKey), NOW)).rejects.toBeInstanceOf(ValidationError);
    await expect(deleteAbandonedUploads(f.admin, [1] as unknown as string[], NOW)).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses anonymous visitors and students", async () => {
    const f = await setup();
    for (const viewer of [null, f.student]) {
      await expect(findAbandonedUploads(viewer, NOW)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(deleteAbandonedUploads(viewer, [newResourceFileKey()], NOW)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});

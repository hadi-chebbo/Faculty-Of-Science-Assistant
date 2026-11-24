import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UPLOAD_CONTENT_TYPE } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { getStorage } from "@/lib/storage/config";
import { newResourceFileKey } from "@/lib/storage/keys";
import { signUploadTicket } from "@/lib/storage/upload-ticket";
import type { Viewer } from "../viewer";
import { listResources } from "./resources";
import { createResource } from "./write";

let dir: string;
beforeAll(async () => {
  process.env.AUTH_SECRET = "status-filter-test-secret-0123456789abcdef0123";
  delete process.env.STORAGE_DRIVER;
  delete process.env.VERCEL;
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "ua-status-filter-"));
  process.env.STORAGE_LOCAL_DIR = dir;
});
beforeEach(async () => {
  await truncateAllTables();
});
afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
  await closeDb();
});

async function setup() {
  const { Course, User } = getDb();
  const admin = await User.create({ email: "admin@example.com", passwordHash: "x", role: "admin" });
  const course = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
  const viewer = { id: admin.id, role: admin.role } as Viewer;
  const key = newResourceFileKey();
  await getStorage().put(key, new TextEncoder().encode("%PDF-1.4\nbody"), UPLOAD_CONTENT_TYPE);
  await createResource(viewer, { courseId: course.id, type: "lecture", title: "Live", isPublished: true, fileTicket: await signUploadTicket(key) });
  await createResource(viewer, { courseId: course.id, type: "lecture", title: "Hidden", isPublished: false });
  return viewer;
}

describe("the status filter", () => {
  it("lists only published files or only drafts for an admin", async () => {
    const admin = await setup();
    expect((await listResources(admin)).total).toBe(2);
    expect((await listResources(admin, { status: "published" })).items.map((r) => r.title)).toEqual(["Live"]);
    expect((await listResources(admin, { status: "draft" })).items.map((r) => r.title)).toEqual(["Hidden"]);
  });

  it("never shows a student a draft, even when asked for drafts", async () => {
    await setup();
    expect((await listResources(null, { status: "draft" })).total).toBe(1);
    expect((await listResources(null, { status: "draft" })).items[0].title).toBe("Live");
  });
});

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
import { ValidationError } from "../errors";
import type { Viewer } from "../viewer";
import { getResourceForEdit } from "./write";
import { listResources } from "./resources";
import type { ResourceInput } from "./schemas";
import { createResource, updateResource } from "./write";

let dir: string;
const PDF_BYTES = new TextEncoder().encode("%PDF-1.4\nbody");

beforeAll(async () => {
  process.env.AUTH_SECRET = "text-check-test-secret-0123456789abcdef01234";
  delete process.env.STORAGE_DRIVER;
  delete process.env.VERCEL;
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "ua-text-check-"));
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
  return { admin: { id: admin.id, role: admin.role } as Viewer, course };
}
type Fixture = Awaited<ReturnType<typeof setup>>;

const input = (f: Fixture, extra: Partial<ResourceInput> = {}): ResourceInput => ({
  courseId: f.course.id, type: "lecture", title: "Lecture 1", isPublished: false, ...extra,
});

async function ticket() {
  const key = newResourceFileKey();
  await getStorage().put(key, PDF_BYTES, UPLOAD_CONTENT_TYPE);
  return signUploadTicket(key);
}

const columns = async (id: string) => {
  const row = await getDb().Resource.findByPk(id);
  return { pageCount: row!.pageCount, textPageCount: row!.textPageCount };
};

describe("the text check saved with a file", () => {
  it("is stored when a new file comes in on create", async () => {
    const f = await setup();
    const created = await createResource(f.admin, input(f, { fileTicket: await ticket(), textCheck: { pageCount: 12, textPageCount: 0 } }));
    expect(await columns(created.id)).toEqual({ pageCount: 12, textPageCount: 0 });
  });

  it("is null when the file comes without a check", async () => {
    const f = await setup();
    const created = await createResource(f.admin, input(f, { fileTicket: await ticket() }));
    expect(await columns(created.id)).toEqual({ pageCount: null, textPageCount: null });
  });

  it("is replaced when the file is replaced, and nulled when the new file has no check", async () => {
    const f = await setup();
    const created = await createResource(f.admin, input(f, { fileTicket: await ticket(), textCheck: { pageCount: 4, textPageCount: 4 } }));
    await updateResource(f.admin, created.id, input(f, { fileTicket: await ticket(), textCheck: { pageCount: 9, textPageCount: 3 } }));
    expect(await columns(created.id)).toEqual({ pageCount: 9, textPageCount: 3 });
    await updateResource(f.admin, created.id, input(f, { fileTicket: await ticket() }));
    expect(await columns(created.id)).toEqual({ pageCount: null, textPageCount: null });
  });

  it("is kept when other fields change", async () => {
    const f = await setup();
    const created = await createResource(f.admin, input(f, { fileTicket: await ticket(), textCheck: { pageCount: 4, textPageCount: 1 } }));
    await updateResource(f.admin, created.id, input(f, { title: "Renamed" }));
    expect(await columns(created.id)).toEqual({ pageCount: 4, textPageCount: 1 });
  });

  it("is ignored without a new file", async () => {
    const f = await setup();
    const created = await createResource(f.admin, input(f, { textCheck: { pageCount: 4, textPageCount: 0 } }));
    expect(await columns(created.id)).toEqual({ pageCount: null, textPageCount: null });
    const withFile = await createResource(f.admin, input(f, { title: "B", fileTicket: await ticket(), textCheck: { pageCount: 4, textPageCount: 4 } }));
    await updateResource(f.admin, withFile.id, input(f, { title: "B", textCheck: { pageCount: 8, textPageCount: 0 } }));
    expect(await columns(withFile.id)).toEqual({ pageCount: 4, textPageCount: 4 });
  });

  it("never affects publishing", async () => {
    const f = await setup();
    const created = await createResource(f.admin, input(f, { fileTicket: await ticket(), textCheck: { pageCount: 4, textPageCount: 0 }, isPublished: true }));
    expect(created.isPublished).toBe(true);
  });

  it("is rejected when it is not valid", async () => {
    const f = await setup();
    const bad = [
      { pageCount: 3, textPageCount: 4 },
      { pageCount: 0, textPageCount: 0 },
      { pageCount: 3, textPageCount: -1 },
      { pageCount: 1.5, textPageCount: 1 },
      { pageCount: 10_001, textPageCount: 1 },
      { pageCount: "3", textPageCount: 1 },
    ];
    for (const textCheck of bad) {
      const error = await createResource(f.admin, input(f, { textCheck: textCheck as never })).then(() => null, (e: unknown) => e);
      expect(error, JSON.stringify(textCheck)).toBeInstanceOf(ValidationError);
    }
  });

  it("is shown to the admin on the edit form and the list, not to students", async () => {
    const f = await setup();
    const created = await createResource(f.admin, input(f, { fileTicket: await ticket(), textCheck: { pageCount: 5, textPageCount: 2 }, isPublished: true }));
    expect((await getResourceForEdit(f.admin, created.id)).textCheck).toEqual({ pageCount: 5, textPageCount: 2 });
    expect((await listResources(f.admin)).items[0].textCheck).toEqual({ pageCount: 5, textPageCount: 2 });
    const student = (await listResources(null)).items[0];
    expect(student).not.toHaveProperty("textCheck");
  });
});

describe("the scanned filter", () => {
  it("lists only scanned and partly scanned files, for an admin", async () => {
    const f = await setup();
    const make = async (title: string, textCheck?: { pageCount: number; textPageCount: number }) =>
      createResource(f.admin, input(f, { title, fileTicket: await ticket(), ...(textCheck ? { textCheck } : {}) }));
    await make("Scanned", { pageCount: 3, textPageCount: 0 });
    await make("Partly", { pageCount: 3, textPageCount: 2 });
    await make("Digital", { pageCount: 3, textPageCount: 3 });
    await make("Unchecked");
    const titles = (await listResources(f.admin, { text: "scanned" })).items.map((r) => r.title).sort();
    expect(titles).toEqual(["Partly", "Scanned"]);
    expect((await listResources(f.admin)).total).toBe(4);
    expect((await listResources(f.admin, { text: "scanned", courseCode: "test301" })).total).toBe(2);
    expect((await listResources(f.admin, { text: "scanned", courseCode: "OTHER" })).total).toBe(0);
  });

  it("is ignored for students", async () => {
    const f = await setup();
    await createResource(f.admin, input(f, { title: "Digital", isPublished: true, fileTicket: await ticket(), textCheck: { pageCount: 3, textPageCount: 3 } }));
    expect((await listResources(null, { text: "scanned" })).total).toBe(1);
  });
});

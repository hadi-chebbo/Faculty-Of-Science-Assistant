import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { UPLOAD_CONTENT_TYPE, UPLOAD_MAX_BYTES } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { getStorage } from "@/lib/storage/config";
import { newResourceFileKey } from "@/lib/storage/keys";
import { signUploadTicket } from "@/lib/storage/upload-ticket";
import { ValidationError } from "../errors";
import type { Viewer } from "../viewer";
import type { ResourceInput } from "./schemas";
import { createResource, deleteResource, updateResource } from "./write";

const URL_A = "https://example.com/a";
const PDF_BYTES = new TextEncoder().encode("%PDF-1.4\nbody");
let dir: string;

beforeAll(async () => {
  process.env.AUTH_SECRET = "write-file-test-secret-0123456789abcdef0123";
  delete process.env.STORAGE_DRIVER;
  delete process.env.VERCEL;
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "ua-write-file-"));
  process.env.STORAGE_LOCAL_DIR = dir;
});

beforeEach(async () => {
  await truncateAllTables();
});

afterEach(() => {
  vi.restoreAllMocks();
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

// Puts an object into storage the way the browser would and returns its key and its ticket.
async function upload(bytes: Uint8Array = PDF_BYTES, contentType = UPLOAD_CONTENT_TYPE) {
  const key = newResourceFileKey();
  await getStorage().put(key, bytes, contentType);
  return { key, ticket: await signUploadTicket(key) };
}

const exists = async (key: string) => (await getStorage().stat(key)) !== null;
const rowOf = (id: string) => getDb().Resource.findByPk(id);

async function fieldsOf(promise: Promise<unknown>): Promise<string[]> {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).fields;
}

describe("saving with an uploaded file", () => {
  it("creates a resource with the uploaded file", async () => {
    const f = await setup();
    const { key, ticket } = await upload();
    const created = await createResource(f.admin, input(f, { fileTicket: ticket, isPublished: true }));
    expect(created.hasSource).toBe(true);
    expect((await rowOf(created.id))!.fileKey).toBe(key);
    expect(await exists(key)).toBe(true);
  });

  it("attaches a file to an existing resource on update", async () => {
    const f = await setup();
    const created = await createResource(f.admin, input(f));
    const { key, ticket } = await upload();
    await updateResource(f.admin, created.id, input(f, { fileTicket: ticket }));
    expect((await rowOf(created.id))!.fileKey).toBe(key);
  });

  it("treats a blank or null ticket as no new file", async () => {
    const f = await setup();
    for (const fileTicket of ["", "  ", null]) {
      const created = await createResource(f.admin, input(f, { fileTicket }));
      expect((await rowOf(created.id))!.fileKey).toBeNull();
    }
  });

  it("rejects an invalid or expired ticket", async () => {
    const f = await setup();
    const { key } = await upload();
    const expired = await signUploadTicket(key, 60, new Date(Date.now() - 120_000));
    for (const fileTicket of ["garbage", expired]) {
      expect(await fieldsOf(createResource(f.admin, input(f, { fileTicket })))).toEqual(["file"]);
    }
    expect(await getDb().Resource.count()).toBe(0);
  });

  it("rejects a ticket whose object was never uploaded", async () => {
    const f = await setup();
    const ticket = await signUploadTicket(newResourceFileKey());
    expect(await fieldsOf(createResource(f.admin, input(f, { fileTicket: ticket })))).toEqual(["file"]);
  });

  it("rejects an object that is too big, of the wrong type or not a PDF, and removes it", async () => {
    const f = await setup();
    const tooBig = await upload();
    const realStat = getStorage().stat.bind(getStorage());
    vi.spyOn(getStorage(), "stat").mockImplementation(async (key) => {
      const info = await realStat(key);
      return key === tooBig.key && info ? { ...info, size: UPLOAD_MAX_BYTES + 1 } : info;
    });
    const wrongType = await upload(PDF_BYTES, "text/plain");
    const notPdf = await upload(new TextEncoder().encode("hello, not a pdf"));
    const empty = await upload(new Uint8Array(0));

    for (const { key, ticket } of [tooBig, wrongType, notPdf, empty]) {
      expect(await fieldsOf(createResource(f.admin, input(f, { fileTicket: ticket })))).toEqual(["file"]);
      expect(await exists(key)).toBe(false);
    }
    expect(await getDb().Resource.count()).toBe(0);
  });

  it("rejects a key that already belongs to another resource, and leaves its file alone", async () => {
    const f = await setup();
    const { key, ticket } = await upload();
    const first = await createResource(f.admin, input(f, { fileTicket: ticket }));
    expect(await fieldsOf(createResource(f.admin, input(f, { title: "Copy", fileTicket: ticket })))).toEqual(["file"]);
    const other = await createResource(f.admin, input(f, { title: "Other" }));
    expect(await fieldsOf(updateResource(f.admin, other.id, input(f, { title: "Other", fileTicket: ticket })))).toEqual(["file"]);
    expect((await rowOf(first.id))!.fileKey).toBe(key);
    expect(await exists(key)).toBe(true);
  });

  it("keeps the uploaded file when other checks fail, so the ticket can be used again", async () => {
    const f = await setup();
    const { key, ticket } = await upload();
    const fields = await fieldsOf(createResource(f.admin, input(f, { title: "Bad", chapterId: "33333333-3333-4333-8333-333333333333", fileTicket: ticket })));
    expect(fields).toEqual(["chapterId"]);
    expect(await exists(key)).toBe(true);
    await createResource(f.admin, input(f, { fileTicket: ticket }));
  });

  it("keeps the stored file when an update has no ticket", async () => {
    const f = await setup();
    const { key, ticket } = await upload();
    const created = await createResource(f.admin, input(f, { fileTicket: ticket }));
    await updateResource(f.admin, created.id, input(f, { title: "Renamed" }));
    expect(await rowOf(created.id)).toMatchObject({ title: "Renamed", fileKey: key });
    expect(await exists(key)).toBe(true);
  });

  it("deletes the old object when an update replaces the file, and keeps the new one", async () => {
    const f = await setup();
    const first = await upload();
    const created = await createResource(f.admin, input(f, { fileTicket: first.ticket }));
    const second = await upload();
    await updateResource(f.admin, created.id, input(f, { fileTicket: second.ticket }));
    expect((await rowOf(created.id))!.fileKey).toBe(second.key);
    expect(await exists(first.key)).toBe(false);
    expect(await exists(second.key)).toBe(true);
  });

  it("does not delete the file when the same ticket is saved again", async () => {
    const f = await setup();
    const { key, ticket } = await upload();
    const created = await createResource(f.admin, input(f, { fileTicket: ticket }));
    await updateResource(f.admin, created.id, input(f, { title: "Again", fileTicket: ticket }));
    expect(await exists(key)).toBe(true);
  });

  it("does not delete the old object when the update fails", async () => {
    const f = await setup();
    const first = await upload();
    const created = await createResource(f.admin, input(f, { fileTicket: first.ticket }));
    const second = await upload();
    await fieldsOf(updateResource(f.admin, created.id, input(f, { chapterId: "33333333-3333-4333-8333-333333333333", fileTicket: second.ticket })));
    expect((await rowOf(created.id))!.fileKey).toBe(first.key);
    expect(await exists(first.key)).toBe(true);
  });

  it("succeeds when removing the replaced object fails, and logs without the key", async () => {
    const f = await setup();
    const first = await upload();
    const created = await createResource(f.admin, input(f, { fileTicket: first.ticket }));
    const second = await upload();
    vi.spyOn(getStorage(), "delete").mockRejectedValue(new Error(`boom ${first.key}`));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await updateResource(f.admin, created.id, input(f, { fileTicket: second.ticket }));
    expect((await rowOf(created.id))!.fileKey).toBe(second.key);
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(first.key);
  });
});

describe("sources", () => {
  it("accepts a file and a link together", async () => {
    const f = await setup();
    const { key, ticket } = await upload();
    const created = await createResource(f.admin, input(f, { fileTicket: ticket, externalUrl: URL_A, isPublished: true }));
    expect(await rowOf(created.id)).toMatchObject({ fileKey: key, externalUrl: URL_A, isPublished: true });
  });

  it("accepts a link on a resource that already has a file", async () => {
    const f = await setup();
    const { key, ticket } = await upload();
    const created = await createResource(f.admin, input(f, { fileTicket: ticket }));
    await updateResource(f.admin, created.id, input(f, { externalUrl: URL_A }));
    expect(await rowOf(created.id)).toMatchObject({ fileKey: key, externalUrl: URL_A });
  });

  it("publishes with only a file, or only a link, but not with neither", async () => {
    const f = await setup();
    const { ticket } = await upload();
    await createResource(f.admin, input(f, { fileTicket: ticket, isPublished: true }));
    await createResource(f.admin, input(f, { externalUrl: URL_A, isPublished: true }));
    expect(await fieldsOf(createResource(f.admin, input(f, { isPublished: true })))).toEqual(["isPublished"]);

    const draft = await createResource(f.admin, input(f));
    expect(await fieldsOf(updateResource(f.admin, draft.id, input(f, { isPublished: true })))).toEqual(["isPublished"]);
    const second = await upload();
    await updateResource(f.admin, draft.id, input(f, { isPublished: true, fileTicket: second.ticket }));
  });

  it("keeps a published resource publishable when the link is removed but a file stays", async () => {
    const f = await setup();
    const { ticket } = await upload();
    const created = await createResource(f.admin, input(f, { fileTicket: ticket, externalUrl: URL_A, isPublished: true }));
    await updateResource(f.admin, created.id, input(f, { externalUrl: null, isPublished: true }));
    expect(await rowOf(created.id)).toMatchObject({ externalUrl: null, isPublished: true });
  });
});

describe("deleting", () => {
  it("removes the stored object with the resource", async () => {
    const f = await setup();
    const { key, ticket } = await upload();
    const created = await createResource(f.admin, input(f, { fileTicket: ticket }));
    await deleteResource(f.admin, created.id);
    expect(await rowOf(created.id)).toBeNull();
    expect(await exists(key)).toBe(false);
  });

  it("still deletes a resource without a file", async () => {
    const f = await setup();
    const created = await createResource(f.admin, input(f, { externalUrl: URL_A }));
    await deleteResource(f.admin, created.id);
    expect(await rowOf(created.id)).toBeNull();
  });

  it("succeeds when removing the object fails, and logs without the key", async () => {
    const f = await setup();
    const { key, ticket } = await upload();
    const created = await createResource(f.admin, input(f, { fileTicket: ticket }));
    vi.spyOn(getStorage(), "delete").mockRejectedValue(new Error(`boom ${key}`));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await deleteResource(f.admin, created.id);
    expect(await rowOf(created.id)).toBeNull();
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(key);
  });
});

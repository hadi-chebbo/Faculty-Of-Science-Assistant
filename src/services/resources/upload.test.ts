import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UPLOAD_CONTENT_TYPE, UPLOAD_MAX_BYTES } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { verifyUploadTicket } from "@/lib/storage/upload-ticket";
import { ForbiddenError, ValidationError } from "../errors";
import type { Viewer } from "../viewer";
import { createResourceUpload } from "./upload";

let dir: string;

beforeAll(async () => {
  process.env.AUTH_SECRET = "upload-test-secret-0123456789abcdef0123";
  delete process.env.STORAGE_DRIVER;
  delete process.env.VERCEL;
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "ua-upload-"));
  process.env.STORAGE_LOCAL_DIR = dir;
});

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
  await closeDb();
});

async function users() {
  const { User } = getDb();
  const admin = await User.create({ email: "admin@example.com", passwordHash: "x", role: "admin" });
  const student = await User.create({ email: "student@example.com", passwordHash: "x", role: "student" });
  return {
    admin: { id: admin.id, role: admin.role } as Viewer,
    student: { id: student.id, role: student.role } as Viewer,
    staleAdmin: { id: student.id, role: "admin" } as Viewer,
  };
}

const fieldsOf = async (promise: Promise<unknown>) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).fields;
};

describe("createResourceUpload", () => {
  it("refuses anonymous visitors, students and a stale admin token", async () => {
    const { student, staleAdmin } = await users();
    for (const viewer of [null, student, staleAdmin]) {
      await expect(createResourceUpload(viewer, { size: 10 })).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("refuses a size that is not an integer from 1 to the limit", async () => {
    const { admin } = await users();
    for (const size of [0, -1, 1.5, UPLOAD_MAX_BYTES + 1, Number.NaN, "10", null, undefined]) {
      expect(await fieldsOf(createResourceUpload(admin, { size: size as number }))).toEqual(["file"]);
    }
    await expect(createResourceUpload(admin, { size: UPLOAD_MAX_BYTES })).resolves.toBeDefined();
  });

  it("returns a PUT url with the content type header and a ticket, but not the key", async () => {
    const { admin } = await users();
    const result = await createResourceUpload(admin, { size: 1234 });

    expect(result.upload.method).toBe("PUT");
    expect(result.upload.url).toContain("/api/v1/storage/local");
    expect(result.upload.headers).toEqual({ "Content-Type": UPLOAD_CONTENT_TYPE });

    const key = await verifyUploadTicket(result.ticket);
    expect(key).toMatch(/^resources\/.+\.pdf$/);
    expect(JSON.stringify(result)).not.toContain(key!);
  });
});

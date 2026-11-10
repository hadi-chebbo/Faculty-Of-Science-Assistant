import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { ForbiddenError, LecturerInUseError, LecturerNameTakenError, NotFoundError, ValidationError } from "../errors";
import type { Viewer } from "../viewer";
import {
  createLecturer,
  deleteLecturer,
  lecturerSlug,
  listAdminLecturers,
  normaliseLecturerName,
  updateLecturer,
} from "./admin";

beforeEach(async () => {
  await truncateAllTables();
});
afterAll(closeDb);

const UNKNOWN = "33333333-3333-4333-8333-333333333333";

async function admin(): Promise<NonNullable<Viewer>> {
  const row = await getDb().User.create({
    email: "admin@example.com",
    passwordHash: "x",
    role: "admin",
    emailConfirmedAt: new Date(),
  });
  return { id: row.id, role: "admin" };
}

async function useLecturer(lecturerId: string, isPublished: boolean) {
  const course = (await getDb().Course.findOne()) ?? (await getDb().Course.create({ code: "DEMO301", title: "Demo", semester: 3 }));
  await getDb().Resource.create({ courseId: course.id, type: "lecture", title: "File", language: "en", lecturerId, isPublished, fileKey: isPublished ? "k" : null });
}

describe("lecturerSlug", () => {
  it("removes accents and a leading title, lowercases, hyphenates", () => {
    expect(lecturerSlug("Dr. Ali Ghorayeb")).toBe("ali-ghorayeb");
    expect(lecturerSlug("Pr. Élie Haddad")).toBe("elie-haddad");
    expect(lecturerSlug("Prof Ali")).toBe("ali");
    expect(lecturerSlug("Prof. Jean-Paul  O'Neil")).toBe("jean-paul-o-neil");
    expect(lecturerSlug("DR Ali")).toBe("ali");
  });

  it("keeps a name that is only a title and never returns an empty slug", () => {
    expect(lecturerSlug("Dr")).toBe("dr");
    expect(lecturerSlug("Dr.")).toBe("dr");
    expect(lecturerSlug("???")).toBe("lecturer");
  });

  it("only drops a title that is a whole word", () => {
    expect(lecturerSlug("Drake Smith")).toBe("drake-smith");
  });
});

describe("normaliseLecturerName", () => {
  it("trims and collapses inner whitespace", () => {
    expect(normaliseLecturerName("  Dr.   Ali \t Ghorayeb ")).toBe("Dr. Ali Ghorayeb");
  });
});

describe("createLecturer", () => {
  it("stores the normalised name and a slug", async () => {
    const a = await admin();
    const lecturer = await createLecturer(a, { name: "  Dr.  Ali   Ghorayeb " });
    expect(lecturer).toMatchObject({ name: "Dr. Ali Ghorayeb", slug: "ali-ghorayeb" });
    expect((await getDb().Lecturer.findByPk(lecturer.id))?.slug).toBe("ali-ghorayeb");
  });

  it("refuses empty and too long names with the field name", async () => {
    const a = await admin();
    for (const name of ["   ", "A".repeat(101)]) {
      const error = await createLecturer(a, { name }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fields).toEqual(["name"]);
    }
    expect(await getDb().Lecturer.count()).toBe(0);
  });

  it("refuses a duplicate name ignoring case and spacing", async () => {
    const a = await admin();
    await createLecturer(a, { name: "Dr. Ali Ghorayeb" });
    await expect(createLecturer(a, { name: "dr.  ali ghorayeb" })).rejects.toBeInstanceOf(LecturerNameTakenError);
    expect(await getDb().Lecturer.count()).toBe(1);
  });

  it("turns a race on the unique index into the same error", async () => {
    const a = await admin();
    const results = await Promise.allSettled([createLecturer(a, { name: "Race One" }), createLecturer(a, { name: "race one" })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(LecturerNameTakenError);
  });

  it("adds -2, -3 when the slug is already used", async () => {
    const a = await admin();
    expect((await createLecturer(a, { name: "Dr. Ali Ghorayeb" })).slug).toBe("ali-ghorayeb");
    expect((await createLecturer(a, { name: "Pr. Ali Ghorayeb" })).slug).toBe("ali-ghorayeb-2");
    expect((await createLecturer(a, { name: "Ali Ghorayeb!" })).slug).toBe("ali-ghorayeb-3");
  });

  it("is for the admin only", async () => {
    const student = await getDb().User.create({ email: "s@example.com", passwordHash: "x", role: "student" });
    await expect(createLecturer({ id: student.id, role: "student" }, { name: "X" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createLecturer(null, { name: "X" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("updateLecturer", () => {
  it("renames without changing the slug", async () => {
    const a = await admin();
    const l = await createLecturer(a, { name: "Ali Ghorayeb" });
    const saved = await updateLecturer(a, l.id, { name: " Dr. Ali  Ghorayeb " });
    expect(saved).toMatchObject({ id: l.id, name: "Dr. Ali Ghorayeb", slug: "ali-ghorayeb" });
    expect((await getDb().Lecturer.findByPk(l.id))?.slug).toBe("ali-ghorayeb");
  });

  it("allows its own name in another case but refuses another lecturer's", async () => {
    const a = await admin();
    const one = await createLecturer(a, { name: "Ali One" });
    await createLecturer(a, { name: "Sara Two" });
    expect((await updateLecturer(a, one.id, { name: "ALI ONE" })).name).toBe("ALI ONE");
    await expect(updateLecturer(a, one.id, { name: "sara two" })).rejects.toBeInstanceOf(LecturerNameTakenError);
  });

  it("refuses invalid names and unknown or malformed ids", async () => {
    const a = await admin();
    const l = await createLecturer(a, { name: "Ali One" });
    await expect(updateLecturer(a, l.id, { name: "" })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateLecturer(a, UNKNOWN, { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateLecturer(a, "nope", { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("is for the admin only", async () => {
    await expect(updateLecturer(null, "x", { name: "t" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("deleteLecturer", () => {
  it("deletes an unused lecturer", async () => {
    const a = await admin();
    const l = await createLecturer(a, { name: "Ali One" });
    await deleteLecturer(a, l.id);
    expect(await getDb().Lecturer.count()).toBe(0);
  });

  it("is refused while a draft uses it, and while a published file does, with the count", async () => {
    const a = await admin();
    const l = await createLecturer(a, { name: "Ali One" });
    await useLecturer(l.id, false);
    let error = await deleteLecturer(a, l.id).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LecturerInUseError);
    expect((error as LecturerInUseError).fileCount).toBe(1);
    await useLecturer(l.id, true);
    error = await deleteLecturer(a, l.id).catch((e: unknown) => e);
    expect((error as LecturerInUseError).fileCount).toBe(2);
    expect(await getDb().Lecturer.count()).toBe(1);
  });

  it("refuses unknown or malformed ids", async () => {
    const a = await admin();
    await expect(deleteLecturer(a, UNKNOWN)).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteLecturer(a, "nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("is for the admin only", async () => {
    await expect(deleteLecturer(null, "x")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("listAdminLecturers", () => {
  it("lists by name ignoring case with file counts, drafts included", async () => {
    const a = await admin();
    const zed = await createLecturer(a, { name: "Zed Last" });
    const bob = await createLecturer(a, { name: "bob Middle" });
    await createLecturer(a, { name: "Al First" });
    await useLecturer(bob.id, false);
    await useLecturer(bob.id, true);
    await useLecturer(zed.id, true);
    const list = await listAdminLecturers(a);
    expect(list.map((l) => [l.name, l.fileCount])).toEqual([["Al First", 0], ["bob Middle", 2], ["Zed Last", 1]]);
    expect(list[0]).toMatchObject({ slug: "al-first", id: expect.any(String) });
  });

  it("is for the admin only", async () => {
    await expect(listAdminLecturers(null)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

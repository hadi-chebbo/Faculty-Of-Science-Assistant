import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { CourseCodeTakenError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import type { Viewer } from "../viewer";
import { createCourse, listAdminCourses, normaliseCourseCode, updateCourse } from "./admin";

beforeEach(async () => {
  await truncateAllTables();
});
afterAll(closeDb);

async function admin(): Promise<NonNullable<Viewer>> {
  const row = await getDb().User.create({
    email: "admin@example.com",
    passwordHash: "x",
    role: "admin",
    emailConfirmedAt: new Date(),
  });
  return { id: row.id, role: "admin" };
}

describe("normaliseCourseCode", () => {
  it("trims, removes all whitespace and uppercases", () => {
    expect(normaliseCourseCode(" i3 301 ")).toBe("I3301");
    expect(normaliseCourseCode("a\tb\nc")).toBe("ABC");
  });
});

describe("createCourse", () => {
  it("stores the normalised code and trimmed title", async () => {
    const a = await admin();
    const course = await createCourse(a, { code: " i3 301 ", title: "  Algorithms ", semester: 3 });
    expect(course).toMatchObject({ code: "I3301", title: "Algorithms", semester: 3 });
    expect((await getDb().Course.findByPk(course.id))?.code).toBe("I3301");
  });

  it("accepts a semester sent as a string", async () => {
    const a = await admin();
    expect((await createCourse(a, { code: "AB", title: "T", semester: "4" as unknown as number })).semester).toBe(4);
  });

  it("refuses bad codes, titles and semesters with the field names", async () => {
    const a = await admin();
    const fieldsOf = async (input: Parameters<typeof createCourse>[1]) => {
      const error = await createCourse(a, input).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      return (error as ValidationError).fields;
    };
    expect(await fieldsOf({ code: "I3-301", title: "T", semester: 3 })).toEqual(["code"]);
    expect(await fieldsOf({ code: "A", title: "T", semester: 3 })).toEqual(["code"]);
    expect(await fieldsOf({ code: "A".repeat(21), title: "T", semester: 3 })).toEqual(["code"]);
    expect(await fieldsOf({ code: "AB", title: "   ", semester: 3 })).toEqual(["title"]);
    expect(await fieldsOf({ code: "AB", title: "T", semester: 7 })).toEqual(["semester"]);
    expect(await getDb().Course.count()).toBe(0);
  });

  it("refuses a duplicate code ignoring case and spaces", async () => {
    const a = await admin();
    await createCourse(a, { code: "DEMO301", title: "One", semester: 3 });
    await expect(createCourse(a, { code: "demo 301", title: "Two", semester: 3 })).rejects.toBeInstanceOf(CourseCodeTakenError);
    expect(await getDb().Course.count()).toBe(1);
  });

  it("turns a race on the unique index into the same error", async () => {
    const a = await admin();
    const results = await Promise.allSettled([
      createCourse(a, { code: "RACE1", title: "One", semester: 3 }),
      createCourse(a, { code: "race1", title: "Two", semester: 3 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(CourseCodeTakenError);
  });

  it("is for the admin only", async () => {
    const student = await getDb().User.create({ email: "s@example.com", passwordHash: "x", role: "student" });
    const input = { code: "AB", title: "T", semester: 3 };
    await expect(createCourse({ id: student.id, role: "student" }, input)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createCourse(null, input)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("updateCourse", () => {
  it("changes code, title and semester", async () => {
    const a = await admin();
    const c = await createCourse(a, { code: "OLD1", title: "Old", semester: 3 });
    const saved = await updateCourse(a, c.id, { code: "new 1", title: "New", semester: 5 });
    expect(saved).toMatchObject({ id: c.id, code: "NEW1", title: "New", semester: 5 });
  });

  it("changes only the given fields", async () => {
    const a = await admin();
    const c = await createCourse(a, { code: "KEEP1", title: "Keep", semester: 3 });
    expect(await updateCourse(a, c.id, { title: "Changed" })).toMatchObject({ code: "KEEP1", title: "Changed", semester: 3 });
  });

  it("allows its own code in any case but refuses another course's", async () => {
    const a = await admin();
    const one = await createCourse(a, { code: "ONE1", title: "One", semester: 3 });
    await createCourse(a, { code: "TWO2", title: "Two", semester: 3 });
    expect((await updateCourse(a, one.id, { code: "one1" })).code).toBe("ONE1");
    await expect(updateCourse(a, one.id, { code: "two 2" })).rejects.toBeInstanceOf(CourseCodeTakenError);
  });

  it("refuses invalid values and unknown or malformed ids", async () => {
    const a = await admin();
    const c = await createCourse(a, { code: "ONE1", title: "One", semester: 3 });
    await expect(updateCourse(a, c.id, { code: "A" })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateCourse(a, "33333333-3333-4333-8333-333333333333", { title: "x" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateCourse(a, "nope", { title: "x" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("is for the admin only", async () => {
    await expect(updateCourse(null, "x", { title: "t" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("listAdminCourses", () => {
  it("lists by semester then code with resource (drafts included) and chapter counts", async () => {
    const a = await admin();
    const b = await createCourse(a, { code: "BBB1", title: "B", semester: 3 });
    await createCourse(a, { code: "AAA1", title: "A", semester: 3 });
    await createCourse(a, { code: "ZZZ1", title: "Z", semester: 5 });
    const { Resource, Chapter } = getDb();
    await Chapter.create({ courseId: b.id, position: 1, title: "C1" });
    await Chapter.create({ courseId: b.id, position: 2, title: "C2" });
    await Resource.create({ courseId: b.id, type: "lecture", title: "Draft", language: "en", isPublished: false });
    await Resource.create({ courseId: b.id, type: "notes", title: "Second draft", language: "en", isPublished: false });

    const list = await listAdminCourses(a);
    expect(list.map((c) => c.code)).toEqual(["AAA1", "BBB1", "ZZZ1"]);
    expect(list[1]).toMatchObject({ resourceCount: 2, chapterCount: 2 });
    expect(list[0]).toMatchObject({ resourceCount: 0, chapterCount: 0 });
  });

  it("is for the admin only", async () => {
    await expect(listAdminCourses(null)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

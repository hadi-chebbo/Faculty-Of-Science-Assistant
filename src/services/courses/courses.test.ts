import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { NotFoundError, ValidationError } from "../errors";
import type { Viewer } from "../viewer";
import { getCourseByCode, listCoursesBySemester } from "./courses";

const SAMPLE_URL = "https://example.com/sample";
const admin: Viewer = { id: "11111111-1111-4111-8111-111111111111", role: "admin" };
const student: Viewer = { id: "22222222-2222-4222-8222-222222222222", role: "student" };

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeDb();
});

async function seed() {
  const { Course, Resource } = getDb();
  const a = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
  const b = await Course.create({ code: "TEST302", title: "Course B", semester: 3 });
  await Course.create({ code: "TEST501", title: "Course C", semester: 5 });
  await Resource.create({ courseId: a.id, type: "lecture", title: "Published lecture", isPublished: true, externalUrl: SAMPLE_URL });
  await Resource.create({ courseId: a.id, type: "exam", title: "Published exam", academicYearStart: 2024, examSession: "final", isPublished: true, externalUrl: SAMPLE_URL });
  await Resource.create({ courseId: a.id, type: "lecture", title: "Draft lecture" });
  await Resource.create({ courseId: b.id, type: "notes", title: "Draft notes" });
  return { a, b };
}

describe("listCoursesBySemester", () => {
  it("returns only that semester, ordered by code", async () => {
    await seed();
    const list = await listCoursesBySemester(null, 3);
    expect(list.map((c) => c.code)).toEqual(["TEST301", "TEST302"]);
  });

  it("returns an empty list for a semester with no courses", async () => {
    await seed();
    expect(await listCoursesBySemester(null, 6)).toEqual([]);
  });

  it("counts only published resources for anonymous visitors and students", async () => {
    await seed();
    for (const viewer of [null, student]) {
      const list = await listCoursesBySemester(viewer, 3);
      expect(list.map((c) => c.resourceCount)).toEqual([2, 0]);
    }
  });

  it("counts everything for an admin", async () => {
    await seed();
    const list = await listCoursesBySemester(admin, 3);
    expect(list.map((c) => c.resourceCount)).toEqual([3, 1]);
  });
});

describe("listCoursesBySemester input", () => {
  it("rejects a semester that is not 3 to 6 with a ValidationError", async () => {
    for (const semester of [NaN, 2, 7, 3.5]) {
      await expect(listCoursesBySemester(null, semester)).rejects.toBeInstanceOf(ValidationError);
    }
  });

  it("accepts the semester as a string, as it arrives from a URL", async () => {
    await seed();
    expect(await listCoursesBySemester(null, "5" as never)).toHaveLength(1);
  });
});

describe("public course DTOs", () => {
  it("do not expose a course id", async () => {
    await seed();
    const [first] = await listCoursesBySemester(null, 3);
    expect(first).not.toHaveProperty("id");
    expect(await getCourseByCode(null, "TEST301")).not.toHaveProperty("id");
  });
});

describe("getCourseByCode", () => {
  it("groups visible resources by type in the standard type order", async () => {
    await seed();
    const course = await getCourseByCode(null, "TEST301");
    expect(course.groups.map((g) => g.type)).toEqual(["lecture", "exam"]);
    expect(course.groups[0].resources.map((r) => r.title)).toEqual(["Published lecture"]);
  });

  it("hides drafts from students and shows them to an admin", async () => {
    await seed();
    const asStudent = await getCourseByCode(student, "TEST301");
    const asAdmin = await getCourseByCode(admin, "TEST301");
    expect(asStudent.groups.flatMap((g) => g.resources)).toHaveLength(2);
    expect(asAdmin.groups.flatMap((g) => g.resources)).toHaveLength(3);
  });

  it("matches the code regardless of case and surrounding spaces", async () => {
    await seed();
    expect((await getCourseByCode(null, "  test301 ")).code).toBe("TEST301");
  });

  it("returns no groups for a course whose resources are all drafts", async () => {
    await seed();
    expect((await getCourseByCode(null, "TEST302")).groups).toEqual([]);
  });

  it("orders exams newest year first, then partial before final", async () => {
    const { a } = await seed();
    const { Resource } = getDb();
    await Resource.create({ courseId: a.id, type: "exam", title: "A partial", academicYearStart: 2024, examSession: "partial", isPublished: true, externalUrl: SAMPLE_URL });
    await Resource.create({ courseId: a.id, type: "exam", title: "Newer second", academicYearStart: 2025, examSession: "second", isPublished: true, externalUrl: SAMPLE_URL });
    const exams = (await getCourseByCode(null, "TEST301")).groups.find((g) => g.type === "exam");
    expect(exams?.resources.map((r) => r.title)).toEqual(["Newer second", "A partial", "Published exam"]);
  });

  it("throws NotFoundError for a blank or over-long code", async () => {
    await expect(getCourseByCode(null, "   ")).rejects.toBeInstanceOf(NotFoundError);
    await expect(getCourseByCode(null, "X".repeat(21))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError for an unknown code", async () => {
    await expect(getCourseByCode(null, "NOPE999")).rejects.toBeInstanceOf(NotFoundError);
  });
});

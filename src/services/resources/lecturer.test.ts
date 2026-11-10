import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { ValidationError } from "../errors";
import { getChapterPage, getCourseByCode } from "../courses/courses";
import { createLecturer, listLecturerOptions } from "../lecturers/admin";
import { listSavedResources } from "../saved/saved";
import { searchCatalog } from "../search/search";
import type { Viewer } from "../viewer";
import { getResourceForReader } from "./reader";
import { getResource, listResources } from "./resources";
import { createResource, getResourceForEdit, updateResource } from "./write";

const MISSING = "33333333-3333-4333-8333-333333333333";

beforeEach(async () => {
  await truncateAllTables();
});
afterAll(closeDb);

async function setup() {
  const { User, Course, Chapter, Resource, Bookmark } = getDb();
  const adminRow = await User.create({ email: "admin@example.com", passwordHash: "x", role: "admin" });
  const admin: Viewer = { id: adminRow.id, role: "admin" };
  const studentRow = await User.create({ email: "s@example.com", passwordHash: "x", role: "student" });
  const student: NonNullable<Viewer> = { id: studentRow.id, role: "student" };
  const course = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
  const chapter = await Chapter.create({ courseId: course.id, position: 1, title: "Intro" });
  const ada = await createLecturer(admin, { name: "Dr. Ada Example" });
  const alan = await createLecturer(admin, { name: "Dr. Alan Sample" });
  const published = { isPublished: true, fileKey: "k.pdf", courseId: course.id } as const;
  const lecture = await Resource.create({ ...published, type: "lecture", title: "Zebra lecture", chapterId: chapter.id, lecturerId: ada.id });
  const exam = await Resource.create({ ...published, type: "exam", title: "Final", examSession: "final", academicYearStart: 2024, lecturerId: alan.id });
  const plain = await Resource.create({ ...published, type: "notes", title: "Plain notes" });
  const draft = await Resource.create({ courseId: course.id, type: "lecture", title: "Draft lecture", lecturerId: ada.id });
  await Bookmark.create({ userId: student.id, resourceId: lecture.id });
  return { admin, student, course, chapter, ada, alan, lecture, exam, plain, draft };
}
type Fixture = Awaited<ReturnType<typeof setup>>;

const input = (f: Fixture, extra: Record<string, unknown> = {}) => ({
  courseId: f.course.id,
  type: "lecture" as const,
  title: "New lecture",
  externalUrl: "https://example.com/a",
  ...extra,
});

describe("writing lecturerId", () => {
  it("sets, changes and clears the lecturer on update, and stores it on create", async () => {
    const f = await setup();
    const created = await createResource(f.admin, input(f, { lecturerId: f.ada.id }));
    expect(created.lecturer).toEqual({ slug: "ada-example", name: "Dr. Ada Example" });
    expect((await getResourceForEdit(f.admin, created.id)).lecturerId).toBe(f.ada.id);

    const changed = await updateResource(f.admin, created.id, input(f, { lecturerId: f.alan.id }));
    expect(changed.lecturer?.slug).toBe("alan-sample");

    const cleared = await updateResource(f.admin, created.id, input(f, { lecturerId: null }));
    expect(cleared.lecturer).toBeNull();
    expect((await getResourceForEdit(f.admin, created.id)).lecturerId).toBeNull();

    const blank = await createResource(f.admin, input(f, { lecturerId: "" }));
    expect(blank.lecturer).toBeNull();
  });

  it("refuses an unknown or malformed id with a lecturerId field error", async () => {
    const f = await setup();
    for (const bad of [MISSING, "not-a-uuid"]) {
      const error = await createResource(f.admin, input(f, { lecturerId: bad })).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fields).toContain("lecturerId");
      const update = await updateResource(f.admin, f.plain.id, input(f, { lecturerId: bad })).catch((e: unknown) => e);
      expect((update as ValidationError).fields).toContain("lecturerId");
    }
  });

  it("offers every lecturer by name to an admin only", async () => {
    const f = await setup();
    expect((await listLecturerOptions(f.admin)).map((l) => l.name)).toEqual(["Dr. Ada Example", "Dr. Alan Sample"]);
    await expect(listLecturerOptions(null)).rejects.toThrow();
  });
});

describe("reading the lecturer", () => {
  it("filters listResources by lecturer slug", async () => {
    const f = await setup();
    const ada = await listResources(f.admin, { lecturer: "ada-example" });
    expect(ada.items.map((r) => r.title).sort()).toEqual(["Draft lecture", "Zebra lecture"]);
    expect(ada.total).toBe(2);
    expect((await listResources(null, { lecturer: "ada-example" })).items.map((r) => r.title)).toEqual(["Zebra lecture"]);
    expect((await listResources(f.admin, { lecturer: "nobody" })).total).toBe(0);
    expect((await listResources(f.admin, { lecturer: "" })).total).toBe(4);
  });

  it("carries the lecturer on list items, or null", async () => {
    const f = await setup();
    const list = await listResources(null, {});
    const byTitle = new Map(list.items.map((r) => [r.title, r.lecturer]));
    expect(byTitle.get("Zebra lecture")).toEqual({ slug: "ada-example", name: "Dr. Ada Example" });
    expect(byTitle.get("Final")).toEqual({ slug: "alan-sample", name: "Dr. Alan Sample" });
    expect(byTitle.get("Plain notes")).toBeNull();
    expect((await getResource(null, f.lecture.id)).lecturer?.name).toBe("Dr. Ada Example");
  });

  it("carries it on the course outline, chapter page, saved list, search and the reader", async () => {
    const f = await setup();
    const course = await getCourseByCode(null, "TEST301");
    const all = course.groups.flatMap((g) => g.resources);
    expect(all.find((r) => r.title === "Zebra lecture")?.lecturer?.slug).toBe("ada-example");
    expect(all.find((r) => r.title === "Plain notes")?.lecturer).toBeNull();
    expect(course.outline.exams[0].lecturer?.slug).toBe("alan-sample");
    expect(course.outline.chapters[0].groups[0].resources[0].lecturer?.name).toBe("Dr. Ada Example");

    const page = await getChapterPage(null, "TEST301", 1);
    expect(page.chapter.groups[0].resources[0].lecturer?.slug).toBe("ada-example");

    const saved = await listSavedResources(f.student);
    expect(saved[0].items[0].lecturer?.slug).toBe("ada-example");

    const found = await searchCatalog("zebra");
    expect(found.files!.items[0].resource.lecturer?.slug).toBe("ada-example");

    expect((await getResourceForReader(f.lecture.id)).lecturer?.name).toBe("Dr. Ada Example");
    expect((await getResourceForReader(f.plain.id)).lecturer).toBeNull();
  });

  it("never shows a draft, or its lecturer, to a student", async () => {
    const f = await setup();
    const course = await getCourseByCode(null, "TEST301");
    expect(course.groups.flatMap((g) => g.resources).map((r) => r.title)).not.toContain("Draft lecture");
    await expect(getResourceForReader(f.draft.id)).rejects.toThrow();
    expect((await getResource(f.admin, f.draft.id)).lecturer?.slug).toBe("ada-example");
  });
});

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { NotFoundError, ValidationError } from "../errors";
import type { Viewer } from "../viewer";
import { getChapterPage, getCourseByCode, listCourses, listCoursesBySemester } from "./courses";

const SAMPLE_URL = "https://example.com/sample";
const SAMPLE_KEY = "resources/sample.pdf";
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
  await Resource.create({ courseId: a.id, type: "lecture", title: "Published lecture", isPublished: true, fileKey: SAMPLE_KEY, externalUrl: SAMPLE_URL });
  await Resource.create({ courseId: a.id, type: "exam", title: "Published exam", academicYearStart: 2024, examSession: "final", isPublished: true, fileKey: SAMPLE_KEY, externalUrl: SAMPLE_URL });
  await Resource.create({ courseId: a.id, type: "lecture", title: "Draft lecture" });
  await Resource.create({ courseId: b.id, type: "notes", title: "Draft notes" });
  return { a, b };
}

describe("listCourses", () => {
  it("returns every course across semesters, ordered by code", async () => {
    await seed();
    const list = await listCourses(admin);
    expect(list).toEqual([
      { id: expect.any(String), code: "TEST301", title: "Course A", semester: 3 },
      { id: expect.any(String), code: "TEST302", title: "Course B", semester: 3 },
      { id: expect.any(String), code: "TEST501", title: "Course C", semester: 5 },
    ]);
  });
});

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
    await Resource.create({ courseId: a.id, type: "exam", title: "A partial", academicYearStart: 2024, examSession: "partial", isPublished: true, fileKey: SAMPLE_KEY, externalUrl: SAMPLE_URL });
    await Resource.create({ courseId: a.id, type: "exam", title: "Newer second", academicYearStart: 2025, examSession: "second", isPublished: true, fileKey: SAMPLE_KEY, externalUrl: SAMPLE_URL });
    const exams = (await getCourseByCode(null, "TEST301")).groups.find((g) => g.type === "exam");
    expect(exams?.resources.map((r) => r.title)).toEqual(["Newer second", "A partial", "Published exam"]);
  });

  it("attaches visible solutions to their exam, keeping each group and its resources intact", async () => {
    const { a } = await seed();
    const { Resource } = getDb();
    const exam = (await Resource.findOne({ where: { courseId: a.id, title: "Published exam" } }))!;
    for (const [title, isPublished] of [["Solution one", true], ["Solution two", true], ["Draft solution", false]] as const) {
      await Resource.create({ courseId: a.id, type: "solution", title, solutionOfId: exam.id, isPublished, fileKey: SAMPLE_KEY, externalUrl: SAMPLE_URL });
    }
    const titlesOf = async (viewer: Viewer) => {
      const course = await getCourseByCode(viewer, "TEST301");
      const examItem = course.groups.find((g) => g.type === "exam")!.resources;
      return { groups: course.groups.map((g) => [g.type, g.resources.length]), solutions: examItem[0].solutions.map((s) => s.title) };
    };
    expect(await titlesOf(null)).toEqual({
      groups: [["lecture", 1], ["exam", 1], ["solution", 2]],
      solutions: ["Solution one", "Solution two"],
    });
    expect((await titlesOf(admin)).solutions).toEqual(["Draft solution", "Solution one", "Solution two"]);
    expect((await titlesOf(admin)).groups).toEqual([["lecture", 2], ["exam", 1], ["solution", 3]]);
  });

  it("throws NotFoundError for a blank or over-long code", async () => {
    await expect(getCourseByCode(null, "   ")).rejects.toBeInstanceOf(NotFoundError);
    await expect(getCourseByCode(null, "X".repeat(21))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError for an unknown code", async () => {
    await expect(getCourseByCode(null, "NOPE999")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("getCourseByCode outline", () => {
  async function seedChapters() {
    const { Course, Chapter, Resource } = getDb();
    const course = await Course.create({ code: "OUT301", title: "Outline course", semester: 3 });
    const other = await Course.create({ code: "OUT302", title: "Other course", semester: 3 });
    // Created out of order on purpose.
    await Chapter.create({ courseId: course.id, position: 2, title: "Second" });
    const one = await Chapter.create({ courseId: course.id, position: 1, title: "First" });
    await Chapter.create({ courseId: course.id, position: 3, title: "Empty" });
    const foreign = await Chapter.create({ courseId: other.id, position: 1, title: "Foreign" });
    const make = (title: string, type: string, extra: Record<string, unknown> = {}) =>
      Resource.create({ courseId: course.id, type, title, isPublished: true, fileKey: SAMPLE_KEY, externalUrl: SAMPLE_URL, ...extra } as never);
    return { one, foreign, make };
  }
  const titles = (groups: { resources: { title: string }[] }[]) => groups.map((g) => g.resources.map((r) => r.title));

  it("returns every chapter in position order, empty ones included", async () => {
    const { one, make } = await seedChapters();
    await make("Lecture", "lecture", { chapterId: one.id });
    const { chapters } = (await getCourseByCode(null, "OUT301")).outline;
    expect(chapters.map((c) => [c.position, c.title, c.itemCount])).toEqual([[1, "First", 1], [2, "Second", 0], [3, "Empty", 0]]);
    expect(chapters[2].groups).toEqual([]);
  });

  it("groups a chapter by type in study order, only types that have rows", async () => {
    const { one, make } = await seedChapters();
    await make("An other", "other", { chapterId: one.id });
    await make("An exercise", "exercise", { chapterId: one.id });
    await make("A note", "notes", { chapterId: one.id });
    await make("A lecture", "lecture", { chapterId: one.id });
    const [chapter] = (await getCourseByCode(null, "OUT301")).outline.chapters;
    expect(chapter.groups.map((g) => g.type)).toEqual(["lecture", "notes", "exercise", "other"]);
    expect(chapter.itemCount).toBe(4);
  });

  it("does not list a linked solution on its own, but lists an unlinked one in its chapter or General", async () => {
    const { one, make } = await seedChapters();
    const exercise = await make("Exercise", "exercise", { chapterId: one.id });
    await make("Linked solution", "solution", { solutionOfId: exercise.id, chapterId: one.id });
    await make("Loose solution", "solution", { chapterId: one.id });
    await make("General loose solution", "solution");
    const { outline } = await getCourseByCode(null, "OUT301");
    expect(titles(outline.chapters[0].groups)).toEqual([["Exercise"], ["Loose solution"]]);
    expect(outline.chapters[0].itemCount).toBe(2);
    expect(outline.chapters[0].groups[0].resources[0].solutions.map((s) => s.title)).toEqual(["Linked solution"]);
    expect(titles(outline.general)).toEqual([["General loose solution"]]);
  });

  it("lists a solution whose target the viewer cannot see", async () => {
    const { make } = await seedChapters();
    const draft = await make("Draft exercise", "exercise", { isPublished: false });
    await make("Solution of a draft", "solution", { solutionOfId: draft.id });
    expect(titles((await getCourseByCode(null, "OUT301")).outline.general)).toEqual([["Solution of a draft"]]);
    // The admin sees the target, so the solution is a link on its row instead.
    expect(titles((await getCourseByCode(admin, "OUT301")).outline.general)).toEqual([["Draft exercise"]]);
  });

  it("hides drafts from anonymous visitors and shows them to an admin", async () => {
    const { one, make } = await seedChapters();
    await make("Draft lecture", "lecture", { chapterId: one.id, isPublished: false });
    await make("Draft general", "notes", { isPublished: false });
    await make("Draft exam", "exam", { isPublished: false, academicYearStart: 2024, examSession: "final" });
    const anonymous = (await getCourseByCode(null, "OUT301")).outline;
    expect(anonymous.chapters[0].itemCount).toBe(0);
    expect(anonymous.general).toEqual([]);
    expect(anonymous.exams).toEqual([]);
    const asAdmin = (await getCourseByCode(admin, "OUT301")).outline;
    expect(asAdmin.chapters[0].itemCount).toBe(1);
    expect(titles(asAdmin.general)).toEqual([["Draft general"]]);
    expect(asAdmin.exams.map((e) => e.title)).toEqual(["Draft exam"]);
  });

  it("keeps exams only in outline.exams, newest year first", async () => {
    const { make } = await seedChapters();
    // The database does not allow an exam in a chapter.
    await make("Old exam", "exam", { academicYearStart: 2022, examSession: "final" });
    await make("New exam", "exam", { academicYearStart: 2024, examSession: "partial" });
    const { outline } = await getCourseByCode(null, "OUT301");
    expect(outline.exams.map((e) => e.title)).toEqual(["New exam", "Old exam"]);
    expect(outline.chapters.every((c) => c.itemCount === 0)).toBe(true);
    expect(outline.general).toEqual([]);
  });

  it("treats a resource in a chapter of another course as General", async () => {
    const { foreign, make } = await seedChapters();
    await make("Misfiled", "lecture", { chapterId: foreign.id });
    const { outline } = await getCourseByCode(null, "OUT301");
    expect(titles(outline.general)).toEqual([["Misfiled"]]);
    expect(outline.chapters.every((c) => c.itemCount === 0)).toBe(true);
  });

  it("gives a course without chapters no chapters and everything non-exam in General", async () => {
    await seed();
    const { outline, groups } = await getCourseByCode(null, "TEST301");
    expect(outline.chapters).toEqual([]);
    expect(titles(outline.general)).toEqual([["Published lecture"]]);
    expect(outline.exams.map((e) => e.title)).toEqual(["Published exam"]);
    expect(groups.map((g) => g.type)).toEqual(["lecture", "exam"]);
  });
});

describe("getChapterPage", () => {
  async function seedPages() {
    const { Course, Chapter, Resource } = getDb();
    const course = await Course.create({ code: "CHP301", title: "Chapter course", semester: 3 });
    const other = await Course.create({ code: "CHP302", title: "Other", semester: 3 });
    await Chapter.create({ courseId: other.id, position: 1, title: "Foreign" });
    const [one, , three, four] = await Promise.all(
      [1, 2, 3, 4].map((position) => Chapter.create({ courseId: course.id, position, title: `Chapter title ${position}` })),
    );
    const make = (chapterId: string, title: string, type: string, extra: Record<string, unknown> = {}) =>
      Resource.create({ courseId: course.id, chapterId, type, title, isPublished: true, fileKey: SAMPLE_KEY, externalUrl: SAMPLE_URL, ...extra } as never);
    // Chapter 2 is empty and chapter 3 only has a draft.
    await make(one.id, "Exercise A", "exercise");
    await make(one.id, "Lecture A", "lecture");
    await make(one.id, "Note A", "notes");
    await make(three.id, "Draft", "lecture", { isPublished: false });
    await make(four.id, "Lecture D", "lecture");
  }

  it("returns the chapter with its groups in study order", async () => {
    await seedPages();
    const page = await getChapterPage(null, "CHP301", "1");
    expect(page.course).toEqual({ code: "CHP301", title: "Chapter course", semester: 3 });
    expect(page.chapter.title).toBe("Chapter title 1");
    expect(page.chapter.groups.map((g) => [g.type, g.resources.map((r) => r.title)])).toEqual([
      ["lecture", ["Lecture A"]],
      ["notes", ["Note A"]],
      ["exercise", ["Exercise A"]],
    ]);
  });

  it("skips empty chapters for previous and next, and has null at the ends", async () => {
    await seedPages();
    const first = await getChapterPage(null, "CHP301", 1);
    expect(first.previous).toBeNull();
    expect(first.next).toEqual({ position: 4, title: "Chapter title 4" });
    const last = await getChapterPage(null, "CHP301", "4");
    expect(last.previous).toEqual({ position: 1, title: "Chapter title 1" });
    expect(last.next).toBeNull();
  });

  it("returns an empty chapter with no groups", async () => {
    await seedPages();
    const page = await getChapterPage(null, "CHP301", "2");
    expect(page.chapter.groups).toEqual([]);
    expect(page.previous?.position).toBe(1);
    expect(page.next?.position).toBe(4);
  });

  it("hides drafts from anonymous visitors but not from an admin", async () => {
    await seedPages();
    expect((await getChapterPage(null, "CHP301", "3")).chapter.groups).toEqual([]);
    const asAdmin = await getChapterPage(admin, "CHP301", "3");
    expect(asAdmin.chapter.groups[0].resources.map((r) => r.title)).toEqual(["Draft"]);
    expect((await getChapterPage(admin, "CHP301", "2")).next?.position).toBe(3);
  });

  it("throws NotFoundError for an unknown course, an unknown position or a bad position", async () => {
    await seedPages();
    await expect(getChapterPage(null, "NOPE999", "1")).rejects.toBeInstanceOf(NotFoundError);
    for (const position of ["99", "1.5", "abc", "-1", "0", ""]) {
      await expect(getChapterPage(null, "CHP301", position)).rejects.toBeInstanceOf(NotFoundError);
    }
    await expect(getChapterPage(null, "CHP302", "2")).rejects.toBeInstanceOf(NotFoundError);
  });
});

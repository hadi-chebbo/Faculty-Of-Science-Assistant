import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { CHAPTER_COUNT_MAX, type UserRole } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import type { Viewer } from "../viewer";
import { createChapter, deleteChapter, listChapters, listChaptersWithCounts, renameChapter, reorderChapters } from "./chapters";

const MISSING_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeDb();
});

async function createUser(role: UserRole, email: string) {
  const user = await getDb().User.create({ email, passwordHash: "not-a-real-hash", role });
  return { viewer: { id: user.id, role: user.role } as Viewer };
}

async function setup() {
  const { Course, Chapter } = getDb();
  const { viewer: admin } = await createUser("admin", "admin@example.com");
  const { viewer: student } = await createUser("student", "student@example.com");
  const course = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
  const other = await Course.create({ code: "TEST302", title: "Course B", semester: 3 });
  const otherChapter = await Chapter.create({ courseId: other.id, position: 1, title: "Other 1" });
  return { admin, student, course, other, otherChapter };
}

type Fixture = Awaited<ReturnType<typeof setup>>;

// Creates chapters "C1".."Cn" in the main course through the service and returns their ids in order.
async function addChapters(f: Fixture, count: number): Promise<string[]> {
  let list = await listChapters(f.admin, f.course.id);
  for (let i = 1; i <= count; i++) list = await createChapter(f.admin, f.course.id, { title: `C${i}` });
  return list.map((chapter) => chapter.id);
}

const titles = (list: { title: string }[]) => list.map((chapter) => chapter.title);
const positions = (list: { position: number }[]) => list.map((chapter) => chapter.position);

async function fieldsOf(promise: Promise<unknown>): Promise<string[]> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).fields;
}

describe("permission", () => {
  it("refuses anonymous visitors, students and a stale admin token, and writes nothing", async () => {
    const f = await setup();
    const ids = await addChapters(f, 2);
    const staleAdmin: Viewer = { id: f.student!.id, role: "admin" };

    for (const viewer of [null, f.student, staleAdmin]) {
      await expect(listChapters(viewer, f.course.id)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(createChapter(viewer, f.course.id, { title: "New" })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(renameChapter(viewer, ids[0], { title: "New" })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(reorderChapters(viewer, f.course.id, [ids[1], ids[0]])).rejects.toBeInstanceOf(ForbiddenError);
      await expect(deleteChapter(viewer, ids[0])).rejects.toBeInstanceOf(ForbiddenError);
    }

    const rows = await getDb().Chapter.findAll({ where: { courseId: f.course.id }, order: [["position", "ASC"]] });
    expect(rows.map((row) => [row.title, row.position])).toEqual([["C1", 1], ["C2", 2]]);
  });

  it("checks the role before the input", async () => {
    await expect(createChapter(null, "nope", { title: "" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteChapter(null, "nope")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("listChapters", () => {
  it("lists one course's chapters in position order", async () => {
    const f = await setup();
    const { Chapter } = getDb();
    await Chapter.create({ courseId: f.course.id, position: 2, title: "Second" });
    await Chapter.create({ courseId: f.course.id, position: 1, title: "First" });
    const list = await listChapters(f.admin, f.course.id);
    expect(list.map(({ position, title }) => [position, title])).toEqual([[1, "First"], [2, "Second"]]);
    expect(await listChapters(f.admin, f.other.id)).toHaveLength(1);
  });

  it("returns an empty list for a course without chapters and refuses unknown courses", async () => {
    const f = await setup();
    expect(await listChapters(f.admin, f.course.id)).toEqual([]);
    await expect(listChapters(f.admin, MISSING_ID)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listChapters(f.admin, "nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("createChapter", () => {
  it("appends at the end", async () => {
    const f = await setup();
    await createChapter(f.admin, f.course.id, { title: " One " });
    await createChapter(f.admin, f.course.id, { title: "Two" });
    const list = await createChapter(f.admin, f.course.id, { title: "Three" });
    expect(positions(list)).toEqual([1, 2, 3]);
    expect(titles(list)).toEqual(["One", "Two", "Three"]);
  });

  it("rejects bad titles", async () => {
    const f = await setup();
    expect(await fieldsOf(createChapter(f.admin, f.course.id, { title: "   " }))).toEqual(["title"]);
    expect(await fieldsOf(createChapter(f.admin, f.course.id, { title: "x".repeat(201) }))).toEqual(["title"]);
    expect(await fieldsOf(createChapter(f.admin, f.course.id, {} as { title: string }))).toEqual(["title"]);
    expect(await listChapters(f.admin, f.course.id)).toEqual([]);
  });

  it("refuses unknown and malformed courses", async () => {
    const f = await setup();
    await expect(createChapter(f.admin, MISSING_ID, { title: "A" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(createChapter(f.admin, "nope", { title: "A" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses the 101st chapter", async () => {
    const f = await setup();
    await getDb().Chapter.bulkCreate(
      Array.from({ length: CHAPTER_COUNT_MAX }, (_, i) => ({ courseId: f.course.id, position: i + 1, title: `C${i + 1}` })),
    );
    expect(await fieldsOf(createChapter(f.admin, f.course.id, { title: "One too many" }))).toEqual(["chapters"]);
    expect(await getDb().Chapter.count({ where: { courseId: f.course.id } })).toBe(CHAPTER_COUNT_MAX);
  });
});

describe("renameChapter", () => {
  it("renames and keeps the position", async () => {
    const f = await setup();
    const ids = await addChapters(f, 3);
    const list = await renameChapter(f.admin, ids[1], { title: " Renamed " });
    expect(titles(list)).toEqual(["C1", "Renamed", "C3"]);
    expect(positions(list)).toEqual([1, 2, 3]);
  });

  it("rejects bad titles and unknown or malformed ids", async () => {
    const f = await setup();
    const ids = await addChapters(f, 1);
    expect(await fieldsOf(renameChapter(f.admin, ids[0], { title: "" }))).toEqual(["title"]);
    await expect(renameChapter(f.admin, MISSING_ID, { title: "A" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(renameChapter(f.admin, "nope", { title: "A" })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("reorderChapters", () => {
  it("reverses a list of five", async () => {
    const f = await setup();
    const ids = await addChapters(f, 5);
    const list = await reorderChapters(f.admin, f.course.id, [...ids].reverse());
    expect(titles(list)).toEqual(["C5", "C4", "C3", "C2", "C1"]);
    expect(positions(list)).toEqual([1, 2, 3, 4, 5]);
  });

  it("moves one chapter to the front", async () => {
    const f = await setup();
    const ids = await addChapters(f, 4);
    const list = await reorderChapters(f.admin, f.course.id, [ids[2], ids[0], ids[1], ids[3]]);
    expect(titles(list)).toEqual(["C3", "C1", "C2", "C4"]);
  });

  it("works on a full course and on an empty one", async () => {
    const f = await setup();
    expect(await reorderChapters(f.admin, f.course.id, [])).toEqual([]);
    const ids = await addChapters(f, CHAPTER_COUNT_MAX);
    const list = await reorderChapters(f.admin, f.course.id, [...ids].reverse());
    expect(list[0].title).toBe(`C${CHAPTER_COUNT_MAX}`);
    expect(positions(list)).toEqual(Array.from({ length: CHAPTER_COUNT_MAX }, (_, i) => i + 1));
  });

  it("rejects every list that is not exactly the course's chapters", async () => {
    const f = await setup();
    const ids = await addChapters(f, 3);
    const bad = (chapterIds: unknown) => fieldsOf(reorderChapters(f.admin, f.course.id, chapterIds as string[]));

    expect(await bad([ids[0], ids[1]])).toEqual(["chapterIds"]);
    expect(await bad([...ids, MISSING_ID])).toEqual(["chapterIds"]);
    expect(await bad([ids[0], ids[0], ids[1]])).toEqual(["chapterIds"]);
    expect(await bad([ids[0], ids[1], f.otherChapter.id])).toEqual(["chapterIds"]);
    expect(await bad([ids[0], ids[1], "nope"])).toEqual(["chapterIds"]);
    expect(await bad("not a list")).toEqual(["chapterIds"]);
    expect(titles(await listChapters(f.admin, f.course.id))).toEqual(["C1", "C2", "C3"]);
  });

  it("refuses unknown courses and leaves another course alone", async () => {
    const f = await setup();
    const ids = await addChapters(f, 2);
    await expect(reorderChapters(f.admin, MISSING_ID, [])).rejects.toBeInstanceOf(NotFoundError);
    await reorderChapters(f.admin, f.course.id, [ids[1], ids[0]]);
    expect((await getDb().Chapter.findByPk(f.otherChapter.id))!.position).toBe(1);
  });
});

describe("deleteChapter", () => {
  it("deletes the first, a middle and the last chapter, keeping positions contiguous", async () => {
    const f = await setup();
    const ids = await addChapters(f, 6);

    let list = await deleteChapter(f.admin, ids[0]);
    expect(titles(list)).toEqual(["C2", "C3", "C4", "C5", "C6"]);
    expect(positions(list)).toEqual([1, 2, 3, 4, 5]);

    list = await deleteChapter(f.admin, ids[3]);
    expect(titles(list)).toEqual(["C2", "C3", "C5", "C6"]);
    expect(positions(list)).toEqual([1, 2, 3, 4]);

    list = await deleteChapter(f.admin, ids[5]);
    expect(titles(list)).toEqual(["C2", "C3", "C5"]);
    expect(positions(list)).toEqual([1, 2, 3]);
    expect((await getDb().Chapter.findByPk(f.otherChapter.id))!.position).toBe(1);
  });

  it("keeps its resources, without a chapter", async () => {
    const f = await setup();
    const ids = await addChapters(f, 2);
    const resource = await getDb().Resource.create({
      courseId: f.course.id, type: "lecture", title: "Lecture", chapterId: ids[0], externalUrl: "https://example.com/a",
    });
    await deleteChapter(f.admin, ids[0]);
    expect((await getDb().Resource.findByPk(resource.id))!.chapterId).toBeNull();
  });

  it("deletes the only chapter and refuses unknown or malformed ids", async () => {
    const f = await setup();
    const ids = await addChapters(f, 1);
    expect(await deleteChapter(f.admin, ids[0])).toEqual([]);
    await expect(deleteChapter(f.admin, ids[0])).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteChapter(f.admin, "nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("listChaptersWithCounts", () => {
  it("counts every resource filed under a chapter, drafts included, and 0 for an empty one", async () => {
    const f = await setup();
    const ids = await addChapters(f, 3);
    const { Resource } = getDb();
    await Resource.create({ courseId: f.course.id, chapterId: ids[0], type: "lecture", title: "Draft", isPublished: false });
    await Resource.create({ courseId: f.course.id, chapterId: ids[0], type: "notes", title: "Published", isPublished: true, externalUrl: "https://example.com/a", fileKey: "resources/a.pdf" });
    await Resource.create({ courseId: f.course.id, chapterId: ids[1], type: "lecture", title: "Only" });
    await Resource.create({ courseId: f.course.id, type: "lecture", title: "No chapter" });

    const list = await listChaptersWithCounts(f.admin, f.course.id);
    expect(list).toEqual([
      { id: ids[0], position: 1, title: "C1", itemCount: 2 },
      { id: ids[1], position: 2, title: "C2", itemCount: 1 },
      { id: ids[2], position: 3, title: "C3", itemCount: 0 },
    ]);
  });

  it("lists only the given course", async () => {
    const f = await setup();
    await getDb().Resource.create({ courseId: f.other.id, chapterId: f.otherChapter.id, type: "lecture", title: "Elsewhere" });
    await addChapters(f, 1);
    expect((await listChaptersWithCounts(f.admin, f.course.id)).map((c) => [c.title, c.itemCount])).toEqual([["C1", 0]]);
    expect((await listChaptersWithCounts(f.admin, f.other.id)).map((c) => [c.title, c.itemCount])).toEqual([["Other 1", 1]]);
  });

  it("refuses non-admins and rejects an unknown course", async () => {
    const f = await setup();
    for (const viewer of [null, f.student]) {
      await expect(listChaptersWithCounts(viewer, f.course.id)).rejects.toBeInstanceOf(ForbiddenError);
    }
    await expect(listChaptersWithCounts(f.admin, MISSING_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});

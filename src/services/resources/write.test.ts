import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { UserRole } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import type { Viewer } from "../viewer";
import type { ResourceInput } from "./schemas";
import { createResource, deleteResource, updateResource } from "./write";

const URL_A = "https://example.com/a";
const URL_B = "https://example.com/b";
const MISSING_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeDb();
});

async function createUser(role: UserRole, email: string) {
  const user = await getDb().User.create({ email, passwordHash: "not-a-real-hash", role });
  return { user, viewer: { id: user.id, role: user.role } as Viewer };
}

async function setup() {
  const { Course, Resource } = getDb();
  const { viewer: admin } = await createUser("admin", "admin@example.com");
  const student = await createUser("student", "student@example.com");
  const course = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
  const other = await Course.create({ code: "TEST302", title: "Course B", semester: 3 });
  const exam = await Resource.create({
    courseId: course.id, type: "exam", title: "Final 2024", academicYearStart: 2024, examSession: "final", isPublished: true, externalUrl: URL_A,
  });
  return { admin, student, course, other, exam };
}

type Fixture = Awaited<ReturnType<typeof setup>>;

const link = (f: Fixture, extra: Partial<ResourceInput> = {}): ResourceInput => ({
  courseId: f.course.id, type: "lecture", title: "Lecture 1", externalUrl: URL_A, isPublished: true, ...extra,
});

async function fieldsOf(promise: Promise<unknown>): Promise<string[]> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).fields;
}

const countResources = () => getDb().Resource.count();

describe("permission", () => {
  it("refuses anonymous visitors, students, a stale admin token and a deleted user, and writes nothing", async () => {
    const f = await setup();
    const before = await countResources();
    const staleAdmin: Viewer = { id: f.student.viewer!.id, role: "admin" };
    const goneAdmin: Viewer = { id: MISSING_ID, role: "admin" };

    for (const viewer of [null, f.student.viewer, staleAdmin, goneAdmin]) {
      await expect(createResource(viewer, link(f))).rejects.toBeInstanceOf(ForbiddenError);
      await expect(updateResource(viewer, f.exam.id, link(f, { title: "Changed" }))).rejects.toBeInstanceOf(ForbiddenError);
      await expect(deleteResource(viewer, f.exam.id)).rejects.toBeInstanceOf(ForbiddenError);
    }

    expect(await countResources()).toBe(before);
    expect((await getDb().Resource.findByPk(f.exam.id))!.title).toBe("Final 2024");
  });

  it("checks the role before the input", async () => {
    const f = await setup();
    await expect(createResource(null, { ...link(f), title: "" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateResource(null, "not-an-id", link(f))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteResource(null, "not-an-id")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("createResource", () => {
  it("creates a published link resource and returns its detail", async () => {
    const f = await setup();
    const created = await createResource(f.admin, link(f, { description: "  Intro  " }));
    expect(created).toMatchObject({
      courseCode: "TEST301", courseTitle: "Course A", type: "lecture", title: "Lecture 1", description: "Intro",
      academicYearStart: null, examSession: null, language: "en", isPublished: true, solutionOf: null, solutions: [],
    });
    const row = await getDb().Resource.findByPk(created.id);
    expect(row).toMatchObject({ externalUrl: URL_A, fileKey: null });
  });

  it("creates a draft without a source, with defaults and blanks turned into null", async () => {
    const f = await setup();
    const created = await createResource(f.admin, {
      courseId: f.course.id, type: "notes", title: " Notes ", description: " ", externalUrl: "", academicYearStart: null,
    });
    expect(created).toMatchObject({ title: "Notes", description: null, language: "en", isPublished: false });
    expect(await getDb().Resource.findByPk(created.id)).toMatchObject({ externalUrl: null, fileKey: null });
  });

  it("creates an exam with a session and year", async () => {
    const f = await setup();
    const created = await createResource(f.admin, link(f, { type: "exam", examSession: "partial", academicYearStart: 2023, language: "fr" }));
    expect(created).toMatchObject({ type: "exam", examSession: "partial", academicYearStart: 2023, language: "fr" });
  });

  it("creates a solution linked to an exam, visible on both sides", async () => {
    const f = await setup();
    const created = await createResource(f.admin, link(f, { type: "solution", solutionOfId: f.exam.id }));
    expect(created.solutionOf).toEqual({ id: f.exam.id, type: "exam", title: "Final 2024" });
  });

  it("rejects each invalid field, naming it", async () => {
    const f = await setup();
    const bad = (extra: Partial<ResourceInput>) => fieldsOf(createResource(f.admin, link(f, extra)));

    expect(await bad({ title: "   " })).toEqual(["title"]);
    expect(await bad({ title: "x".repeat(201) })).toEqual(["title"]);
    expect(await bad({ courseId: "nope" })).toEqual(["courseId"]);
    expect(await bad({ type: "other" as never, language: "de" as never })).toEqual(["language"]);
    expect(await bad({ type: "video" as never })).toEqual(["type"]);
    expect(await bad({ academicYearStart: 1989 })).toEqual(["academicYearStart"]);
    expect(await bad({ academicYearStart: 2101 })).toEqual(["academicYearStart"]);
    expect(await bad({ academicYearStart: 2023.5 })).toEqual(["academicYearStart"]);
    expect(await bad({ type: "exam" })).toEqual(["examSession"]);
    expect(await bad({ examSession: "final" })).toEqual(["examSession"]);
    expect(await bad({ externalUrl: "http://example.com/a" })).toEqual(["externalUrl"]);
    expect(await bad({ externalUrl: "https://" })).toEqual(["externalUrl"]);
    expect(await bad({ solutionOfId: f.exam.id })).toEqual(["solutionOfId"]);
    expect(await countResources()).toBe(1);
  });

  it("rejects a course that does not exist", async () => {
    const f = await setup();
    expect(await fieldsOf(createResource(f.admin, link(f, { courseId: MISSING_ID })))).toEqual(["courseId"]);
  });

  it("rejects a solution target that is missing, in another course, or itself a solution", async () => {
    const f = await setup();
    const { Resource } = getDb();
    const elsewhere = await Resource.create({ courseId: f.other.id, type: "lecture", title: "Elsewhere" });
    const solution = await Resource.create({ courseId: f.course.id, type: "solution", title: "Sol", solutionOfId: f.exam.id });

    for (const solutionOfId of [MISSING_ID, elsewhere.id, solution.id]) {
      expect(await fieldsOf(createResource(f.admin, link(f, { type: "solution", solutionOfId })))).toEqual(["solutionOfId"]);
    }
  });

  it("refuses to publish without a link", async () => {
    const f = await setup();
    expect(await fieldsOf(createResource(f.admin, link(f, { externalUrl: null })))).toEqual(["isPublished"]);
  });
});

describe("updateResource", () => {
  it("replaces every editable field", async () => {
    const f = await setup();
    const updated = await updateResource(f.admin, f.exam.id, {
      courseId: f.other.id, type: "notes", title: "Renamed", description: "New", language: "fr", externalUrl: URL_B, isPublished: false,
    });
    expect(updated).toMatchObject({
      id: f.exam.id, courseCode: "TEST302", type: "notes", title: "Renamed", description: "New", academicYearStart: null,
      examSession: null, language: "fr", isPublished: false,
    });
    expect((await getDb().Resource.findByPk(f.exam.id))!.externalUrl).toBe(URL_B);
  });

  it("answers NotFoundError for an unknown or malformed id", async () => {
    const f = await setup();
    await expect(updateResource(f.admin, MISSING_ID, link(f))).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateResource(f.admin, "not-an-id", link(f))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("validates the input", async () => {
    const f = await setup();
    expect(await fieldsOf(updateResource(f.admin, f.exam.id, link(f, { title: "" })))).toEqual(["title"]);
  });

  it("keeps the fileKey, and publishes a stored file without a link", async () => {
    const f = await setup();
    const file = await getDb().Resource.create({ courseId: f.course.id, type: "lecture", title: "Stored", fileKey: "k/1.pdf" });

    const updated = await updateResource(f.admin, file.id, link(f, { title: "Stored v2", externalUrl: null }));
    expect(updated).toMatchObject({ title: "Stored v2", isPublished: true });
    expect((await getDb().Resource.findByPk(file.id))).toMatchObject({ fileKey: "k/1.pdf", externalUrl: null });
  });

  it("rejects a link on a row that has a stored file", async () => {
    const f = await setup();
    const file = await getDb().Resource.create({ courseId: f.course.id, type: "lecture", title: "Stored", fileKey: "k/1.pdf" });
    expect(await fieldsOf(updateResource(f.admin, file.id, link(f, { isPublished: false })))).toEqual(["externalUrl"]);
    expect((await getDb().Resource.findByPk(file.id))!.externalUrl).toBeNull();
  });

  it("refuses to publish once the link is removed", async () => {
    const f = await setup();
    expect(await fieldsOf(updateResource(f.admin, f.exam.id, link(f, { type: "exam", examSession: "final", externalUrl: null })))).toEqual([
      "isPublished",
    ]);
  });

  it("rejects pointing a solution at itself", async () => {
    const f = await setup();
    const solution = await getDb().Resource.create({ courseId: f.course.id, type: "solution", title: "Sol", solutionOfId: f.exam.id });
    expect(await fieldsOf(updateResource(f.admin, solution.id, link(f, { type: "solution", solutionOfId: solution.id })))).toEqual([
      "solutionOfId",
    ]);
  });

  it("blocks a course change while solutions point at the resource", async () => {
    const f = await setup();
    await getDb().Resource.create({ courseId: f.course.id, type: "solution", title: "Sol", solutionOfId: f.exam.id });
    const input = link(f, { courseId: f.other.id, type: "exam", examSession: "final" });
    expect(await fieldsOf(updateResource(f.admin, f.exam.id, input))).toEqual(["courseId"]);
    expect((await getDb().Resource.findByPk(f.exam.id))!.courseId).toBe(f.course.id);
  });

  it("blocks turning a resource into a solution while solutions point at it", async () => {
    const f = await setup();
    await getDb().Resource.create({ courseId: f.course.id, type: "solution", title: "Sol", solutionOfId: f.exam.id });
    expect(await fieldsOf(updateResource(f.admin, f.exam.id, link(f, { type: "solution" })))).toEqual(["type"]);
    expect((await getDb().Resource.findByPk(f.exam.id))!.type).toBe("exam");
  });

  it("names a field once when it fails two rules", async () => {
    const f = await setup();
    await getDb().Resource.create({ courseId: f.course.id, type: "solution", title: "Sol", solutionOfId: f.exam.id });
    const input = link(f, { courseId: MISSING_ID, type: "exam", examSession: "final" });
    expect(await fieldsOf(updateResource(f.admin, f.exam.id, input))).toEqual(["courseId"]);
  });
});

describe("deleteResource", () => {
  it("removes the row", async () => {
    const f = await setup();
    await deleteResource(f.admin, f.exam.id);
    expect(await getDb().Resource.findByPk(f.exam.id)).toBeNull();
  });

  it("answers NotFoundError for an unknown or malformed id", async () => {
    const f = await setup();
    await expect(deleteResource(f.admin, MISSING_ID)).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteResource(f.admin, "not-an-id")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("keeps a solution that pointed at it, unlinked, and removes bookmarks and completions", async () => {
    const f = await setup();
    const { Resource, Bookmark, Completion } = getDb();
    const solution = await Resource.create({ courseId: f.course.id, type: "solution", title: "Sol", solutionOfId: f.exam.id });
    await Bookmark.create({ userId: f.student.user.id, resourceId: f.exam.id });
    await Completion.create({ userId: f.student.user.id, resourceId: f.exam.id });

    await deleteResource(f.admin, f.exam.id);

    expect((await Resource.findByPk(solution.id))!.solutionOfId).toBeNull();
    expect(await Bookmark.count()).toBe(0);
    expect(await Completion.count()).toBe(0);
  });
});

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { ForbiddenError, NotFoundError } from "../errors";
import { requireAdmin, type Viewer } from "../viewer";
import { getResource, listResources } from "./resources";

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
  const exam = await Resource.create({
    courseId: a.id, type: "exam", title: "Final 2024", academicYearStart: 2024, examSession: "final", isPublished: true, externalUrl: SAMPLE_URL,
  });
  const partial = await Resource.create({
    courseId: a.id, type: "exam", title: "Partial 2024", academicYearStart: 2024, examSession: "partial", isPublished: true, externalUrl: SAMPLE_URL,
  });
  const old = await Resource.create({
    courseId: a.id, type: "exam", title: "Final 2022", academicYearStart: 2022, examSession: "final", isPublished: true, externalUrl: SAMPLE_URL, language: "fr",
  });
  const solution = await Resource.create({
    courseId: a.id, type: "solution", title: "Final 2024 solution", solutionOfId: exam.id, isPublished: true, externalUrl: SAMPLE_URL,
  });
  const draft = await Resource.create({ courseId: a.id, type: "lecture", title: "Draft lecture" });
  const other = await Resource.create({ courseId: b.id, type: "lecture", title: "Other lecture", isPublished: true, externalUrl: SAMPLE_URL });
  return { a, b, exam, partial, old, solution, draft, other };
}

describe("listResources", () => {
  it("hides drafts from anonymous visitors and students, shows them to an admin", async () => {
    await seed();
    expect(await listResources(null)).toHaveLength(5);
    expect(await listResources(student)).toHaveLength(5);
    expect(await listResources(admin)).toHaveLength(6);
  });

  it("orders newest year first, then partial before final, then title", async () => {
    await seed();
    const titles = (await listResources(null, { type: "exam" })).map((r) => r.title);
    expect(titles).toEqual(["Partial 2024", "Final 2024", "Final 2022"]);
  });

  it("filters by each field on its own", async () => {
    await seed();
    expect((await listResources(null, { courseCode: "test302" })).map((r) => r.title)).toEqual(["Other lecture"]);
    expect(await listResources(null, { type: "solution" })).toHaveLength(1);
    expect(await listResources(null, { academicYearStart: 2022 })).toHaveLength(1);
    expect(await listResources(null, { examSession: "partial" })).toHaveLength(1);
    expect((await listResources(null, { language: "fr" })).map((r) => r.title)).toEqual(["Final 2022"]);
  });

  it("combines filters", async () => {
    await seed();
    const result = await listResources(null, { courseCode: "TEST301", type: "exam", academicYearStart: 2024, examSession: "final" });
    expect(result.map((r) => r.title)).toEqual(["Final 2024"]);
    expect(await listResources(null, { courseCode: "TEST302", type: "exam" })).toEqual([]);
  });

  it("does not expose file references", async () => {
    await seed();
    const [first] = await listResources(null);
    expect(first).not.toHaveProperty("fileKey");
    expect(first).not.toHaveProperty("externalUrl");
  });
});

describe("getResource", () => {
  it("returns the resource with its course and linked solution", async () => {
    const { exam, solution } = await seed();
    const detail = await getResource(null, exam.id);
    expect(detail.courseCode).toBe("TEST301");
    expect(detail.courseTitle).toBe("Course A");
    expect(detail.solutions.map((s) => s.id)).toEqual([solution.id]);
    const back = await getResource(null, solution.id);
    expect(back.solutionOf?.id).toBe(exam.id);
  });

  it("does not link to an unpublished solution unless the viewer is an admin", async () => {
    const { exam } = await seed();
    const { Resource } = getDb();
    await Resource.create({ courseId: exam.courseId, type: "solution", title: "Draft solution", solutionOfId: exam.id });
    expect((await getResource(student, exam.id)).solutions).toHaveLength(1);
    expect((await getResource(admin, exam.id)).solutions).toHaveLength(2);
  });

  it("treats an unpublished resource as not found for non-admins", async () => {
    const { draft } = await seed();
    await expect(getResource(null, draft.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getResource(student, draft.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await getResource(admin, draft.id)).title).toBe("Draft lecture");
  });

  it("throws NotFoundError for a missing id and for a malformed id", async () => {
    await expect(getResource(null, "33333333-3333-4333-8333-333333333333")).rejects.toBeInstanceOf(NotFoundError);
    await expect(getResource(null, "42")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("requireAdmin", () => {
  it("throws ForbiddenError for anonymous visitors and students", () => {
    expect(() => requireAdmin(null)).toThrow(ForbiddenError);
    expect(() => requireAdmin(student)).toThrow(ForbiddenError);
  });

  it("passes for an admin", () => {
    expect(() => requireAdmin(admin)).not.toThrow();
  });
});

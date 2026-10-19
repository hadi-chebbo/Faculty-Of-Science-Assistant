import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { UserRole } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { ForbiddenError, NotFoundError } from "../errors";
import type { Viewer } from "../viewer";
import { getResourceForEdit } from "./write";

const MISSING_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeDb();
});

async function createViewer(role: UserRole, email: string): Promise<Viewer> {
  const user = await getDb().User.create({ email, passwordHash: "not-a-real-hash", role });
  return { id: user.id, role: user.role };
}

async function setup() {
  const { Course, Resource } = getDb();
  const admin = await createViewer("admin", "admin@example.com");
  const course = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
  const exam = await Resource.create({
    courseId: course.id, type: "exam", title: "Final 2024", description: "Old exam", academicYearStart: 2024,
    examSession: "final", language: "fr", externalUrl: "https://example.com/a", fileKey: "resources/final.pdf", isPublished: true,
  });
  return { admin, course, exam };
}

describe("getResourceForEdit", () => {
  it("refuses anonymous visitors and students", async () => {
    const f = await setup();
    const student = await createViewer("student", "student@example.com");
    await expect(getResourceForEdit(null, f.exam.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getResourceForEdit(student, f.exam.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("answers not found for an unknown or malformed id", async () => {
    const f = await setup();
    await expect(getResourceForEdit(f.admin, MISSING_ID)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getResourceForEdit(f.admin, "not-a-uuid")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns every editable field of a resource with a file and a backup link", async () => {
    const f = await setup();
    expect(await getResourceForEdit(f.admin, f.exam.id)).toEqual({
      id: f.exam.id, courseId: f.course.id, type: "exam", title: "Final 2024", description: "Old exam",
      academicYearStart: 2024, examSession: "final", language: "fr", externalUrl: "https://example.com/a",
      isPublished: true, hasFile: true, chapterId: null, solutionOf: null,
      solutionCount: 0, updatedAt: expect.any(String),
    });
  });

  it("reports when it was last saved as an ISO date", async () => {
    const f = await setup();
    const { updatedAt } = await getResourceForEdit(f.admin, f.exam.id);
    expect(Number.isNaN(Date.parse(updatedAt))).toBe(false);
    expect(new Date(updatedAt).toISOString()).toBe(updatedAt);
  });

  it("reports a stored file without exposing its key", async () => {
    const f = await setup();
    const row = await getDb().Resource.create({
      courseId: f.course.id, type: "notes", title: "Stored notes", fileKey: "resources/secret-key.pdf",
    });
    const result = await getResourceForEdit(f.admin, row.id);
    expect(result.hasFile).toBe(true);
    expect(result.externalUrl).toBeNull();
    expect(JSON.stringify(result)).not.toContain("secret-key");
  });

  it("includes the resource a solution answers", async () => {
    const f = await setup();
    const solution = await getDb().Resource.create({
      courseId: f.course.id, type: "solution", title: "Solution 2024", solutionOfId: f.exam.id,
    });
    const result = await getResourceForEdit(f.admin, solution.id);
    expect(result.solutionOf).toEqual({ id: f.exam.id, title: "Final 2024" });
  });

  it("counts the resources that are a solution of it, drafts included", async () => {
    const f = await setup();
    const { Resource } = getDb();
    await Resource.create({
      courseId: f.course.id, type: "solution", title: "Solution A", solutionOfId: f.exam.id,
      externalUrl: "https://example.com/s", fileKey: "resources/sol.pdf", isPublished: true,
    });
    await Resource.create({ courseId: f.course.id, type: "solution", title: "Solution B (draft)", solutionOfId: f.exam.id });
    expect((await getResourceForEdit(f.admin, f.exam.id)).solutionCount).toBe(2);
  });
});

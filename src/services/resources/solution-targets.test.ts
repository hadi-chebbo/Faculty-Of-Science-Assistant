import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ExamSession, UserRole } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { ForbiddenError } from "../errors";
import type { Viewer } from "../viewer";
import { listSolutionTargets } from "./solution-targets";

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeDb();
});

async function createUser(role: UserRole, email: string): Promise<NonNullable<Viewer>> {
  const user = await getDb().User.create({ email, passwordHash: "not-a-real-hash", role });
  return { id: user.id, role: user.role };
}

async function createCourse(code: string) {
  return getDb().Course.create({ code, title: `Course ${code}`, semester: 3 });
}

describe("listSolutionTargets", () => {
  it("returns only exercises and exams, drafts included", async () => {
    const { Resource } = getDb();
    const admin = await createUser("admin", "admin@example.com");
    const course = await createCourse("TEST301");
    const base = { courseId: course.id, externalUrl: "https://example.com/x" };
    await Resource.create({ ...base, type: "lecture", title: "Lecture" });
    await Resource.create({ ...base, type: "notes", title: "Notes" });
    await Resource.create({ ...base, type: "other", title: "Other" });
    await Resource.create({ ...base, type: "solution", title: "Solution" });
    await Resource.create({ ...base, type: "exercise", title: "Published sheet", isPublished: true });
    await Resource.create({ ...base, type: "exercise", title: "Draft sheet", isPublished: false });
    await Resource.create({ ...base, type: "exam", title: "Draft exam", academicYearStart: 2024, examSession: "final", isPublished: false });

    const targets = await listSolutionTargets(admin);

    expect(targets.map((t) => t.title).sort()).toEqual(["Draft exam", "Draft sheet", "Published sheet"]);
    expect(Object.keys(targets[0]).sort()).toEqual(["academicYearStart", "courseId", "examSession", "id", "title", "type"]);
  });

  it("orders by course, then exercises by title, then exams newest year first and by session", async () => {
    const { Resource } = getDb();
    const admin = await createUser("admin", "admin@example.com");
    const a = await createCourse("TEST301");
    const b = await createCourse("TEST302");
    const make = (courseId: string, type: "exercise" | "exam", title: string, year?: number, session?: ExamSession) =>
      Resource.create({ courseId, type, title, externalUrl: "https://example.com/x", academicYearStart: year ?? null, examSession: session ?? null });
    // Created out of order on purpose.
    await make(b.id, "exercise", "B sheet");
    await make(a.id, "exam", "A exam 2023 second", 2023, "second");
    await make(a.id, "exam", "A exam 2024 final", 2024, "final");
    await make(a.id, "exercise", "A sheet 2");
    await make(a.id, "exam", "A exam 2024 partial", 2024, "partial");
    await make(a.id, "exam", "A exam 2023 partial", 2023, "partial");
    await make(a.id, "exercise", "A sheet 1");

    const targets = await listSolutionTargets(admin);

    const ofCourse = (id: string) => targets.filter((t) => t.courseId === id).map((t) => t.title);
    expect(ofCourse(a.id)).toEqual([
      "A sheet 1",
      "A sheet 2",
      "A exam 2024 partial",
      "A exam 2024 final",
      "A exam 2023 partial",
      "A exam 2023 second",
    ]);
    expect(ofCourse(b.id)).toEqual(["B sheet"]);
    // Targets of one course are contiguous, and the courses come in a stable order.
    const courseOrder = targets.map((t) => t.courseId);
    expect(courseOrder).toEqual([...courseOrder].sort());
  });

  it("returns an empty list when there are no exercises or exams", async () => {
    const admin = await createUser("admin", "admin@example.com");
    expect(await listSolutionTargets(admin)).toEqual([]);
  });

  it("refuses anonymous visitors, students and a stale admin token", async () => {
    const student = await createUser("student", "student@example.com");
    await expect(listSolutionTargets(null)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listSolutionTargets(student)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listSolutionTargets({ id: student.id, role: "admin" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

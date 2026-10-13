import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { UserRole } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { ForbiddenError } from "../errors";
import type { Viewer } from "../viewer";
import { listChapterOptions } from "./options";

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

describe("listChapterOptions", () => {
  it("returns every course's chapters, ordered by course and then position", async () => {
    const { Course, Chapter } = getDb();
    const admin = await createUser("admin", "admin@example.com");
    const a = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
    const b = await Course.create({ code: "TEST302", title: "Course B", semester: 3 });
    // Created out of order on purpose.
    await Chapter.create({ courseId: a.id, position: 2, title: "A2" });
    await Chapter.create({ courseId: b.id, position: 1, title: "B1" });
    await Chapter.create({ courseId: a.id, position: 1, title: "A1" });

    const options = await listChapterOptions(admin);

    expect(options).toHaveLength(3);
    const ofCourse = (id: string) => options.filter((o) => o.courseId === id).map((o) => [o.position, o.title]);
    expect(ofCourse(a.id)).toEqual([[1, "A1"], [2, "A2"]]);
    expect(ofCourse(b.id)).toEqual([[1, "B1"]]);
    // Chapters of one course are contiguous, and the courses come in a stable order.
    const order = options.map((o) => o.courseId);
    expect(order).toEqual([...order].sort());
    expect(Object.keys(options[0]).sort()).toEqual(["courseId", "id", "position", "title"]);
  });

  it("returns an empty list when there are no chapters", async () => {
    const admin = await createUser("admin", "admin@example.com");
    expect(await listChapterOptions(admin)).toEqual([]);
  });

  it("refuses anonymous visitors, students and a stale admin token", async () => {
    const student = await createUser("student", "student@example.com");
    await expect(listChapterOptions(null)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listChapterOptions(student)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listChapterOptions({ id: student.id, role: "admin" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

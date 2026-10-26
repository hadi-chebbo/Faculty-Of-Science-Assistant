import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { UserRole } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { NotFoundError } from "../errors";
import type { Viewer } from "../viewer";
import { listSavedResourceIds, listSavedResources, saveResource, unsaveResource } from "./saved";

const MISSING_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeDb();
});

async function user(role: UserRole, email: string): Promise<NonNullable<Viewer>> {
  const row = await getDb().User.create({ email, passwordHash: "not-a-real-hash", role });
  return { id: row.id, role: row.role };
}

async function seed() {
  const { Course, Resource } = getDb();
  const course = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
  const make = (title: string, isPublished: boolean) =>
    Resource.create({ courseId: course.id, type: "lecture", title, fileKey: "k", isPublished });
  return { a: await make("A", true), b: await make("B", true), draft: await make("Draft", false) };
}

describe("saveResource", () => {
  it("is idempotent", async () => {
    const student = await user("student", "s@example.com");
    const { a } = await seed();
    await saveResource(student, a.id);
    await saveResource(student, a.id);
    expect(await listSavedResourceIds(student)).toEqual([a.id]);
    expect(await getDb().Bookmark.count()).toBe(1);
  });

  it("survives two saves at the same moment", async () => {
    const student = await user("student", "s@example.com");
    const { a } = await seed();
    await Promise.all([saveResource(student, a.id), saveResource(student, a.id)]);
    expect(await getDb().Bookmark.count()).toBe(1);
  });

  it("does not find a draft, even for the admin, or an unknown or malformed id", async () => {
    const admin = await user("admin", "a@example.com");
    const { draft } = await seed();
    for (const id of [draft.id, MISSING_ID, "not-a-uuid"]) {
      await expect(saveResource(admin, id)).rejects.toBeInstanceOf(NotFoundError);
    }
    expect(await getDb().Bookmark.count()).toBe(0);
  });
});

describe("unsaveResource", () => {
  it("removes the row, and succeeds when nothing was saved", async () => {
    const student = await user("student", "s@example.com");
    const { a } = await seed();
    await unsaveResource(student, a.id);
    await saveResource(student, a.id);
    await unsaveResource(student, a.id);
    await unsaveResource(student, a.id);
    expect(await listSavedResourceIds(student)).toEqual([]);
  });

  it("rejects a malformed id and works for an unknown one", async () => {
    const student = await user("student", "s@example.com");
    await expect(unsaveResource(student, "nope")).rejects.toBeInstanceOf(NotFoundError);
    await expect(unsaveResource(student, MISSING_ID)).resolves.toBeUndefined();
  });

  it("only touches the viewer's own row", async () => {
    const one = await user("student", "one@example.com");
    const two = await user("student", "two@example.com");
    const { a } = await seed();
    await saveResource(one, a.id);
    await saveResource(two, a.id);
    await unsaveResource(one, a.id);
    expect(await listSavedResourceIds(one)).toEqual([]);
    expect(await listSavedResourceIds(two)).toEqual([a.id]);
  });
});

describe("listSavedResources", () => {
  async function course(code: string, semester: number) {
    return getDb().Course.create({ code, title: `Title ${code}`, semester });
  }
  async function resource(courseId: string, title: string) {
    return getDb().Resource.create({ courseId, type: "lecture", title, fileKey: "k", isPublished: true });
  }
  async function saveAt(viewer: NonNullable<Viewer>, resourceId: string, at: string) {
    await getDb().Bookmark.create({ userId: viewer.id, resourceId, createdAt: new Date(at) });
  }
  const itemIds = async (viewer: NonNullable<Viewer>) =>
    (await listSavedResources(viewer)).flatMap((group) => group.items.map((item) => item.id));

  it("is empty when nothing is saved", async () => {
    const student = await user("student", "s@example.com");
    expect(await listSavedResources(student)).toEqual([]);
  });

  it("groups by course, ordered by semester then code, newest save first inside a course", async () => {
    const student = await user("student", "s@example.com");
    const s5 = await course("TEST501", 5);
    const b = await course("TEST302", 3);
    const a = await course("TEST301", 3);
    const r5 = await resource(s5.id, "Five");
    const rb = await resource(b.id, "B");
    const a1 = await resource(a.id, "A1");
    const a2 = await resource(a.id, "A2");
    const a3 = await resource(a.id, "A3");
    await saveAt(student, r5.id, "2026-01-01T10:00:00Z");
    await saveAt(student, rb.id, "2026-01-02T10:00:00Z");
    await saveAt(student, a1.id, "2026-01-03T10:00:00Z");
    await saveAt(student, a3.id, "2026-01-05T10:00:00Z");
    await saveAt(student, a2.id, "2026-01-04T10:00:00Z");

    const groups = await listSavedResources(student);
    expect(groups.map((g) => [g.courseCode, g.semester, g.courseTitle])).toEqual([
      ["TEST301", 3, "Title TEST301"],
      ["TEST302", 3, "Title TEST302"],
      ["TEST501", 5, "Title TEST501"],
    ]);
    expect(groups[0].items.map((i) => i.title)).toEqual(["A3", "A2", "A1"]);
    expect(groups[0].items[0].courseCode).toBe("TEST301");
  });

  it("includes the published solutions of a saved resource", async () => {
    const student = await user("student", "s@example.com");
    const c = await course("TEST301", 3);
    const exam = await resource(c.id, "Exam");
    const solution = await getDb().Resource.create({
      courseId: c.id, type: "solution", title: "Sol", fileKey: "k", isPublished: true, solutionOfId: exam.id,
    });
    await saveResource(student, exam.id);
    const [group] = await listSavedResources(student);
    expect(group.items[0].solutions).toEqual([{ id: solution.id, type: "solution", title: "Sol" }]);
  });

  it("hides an unpublished resource and its empty course, and shows it again when republished", async () => {
    const student = await user("student", "s@example.com");
    const { a, b } = await seed();
    await saveResource(student, a.id);
    await saveResource(student, b.id);
    await a.update({ isPublished: false });
    expect(await itemIds(student)).toEqual([b.id]);
    await b.update({ isPublished: false });
    expect(await listSavedResources(student)).toEqual([]);
    await a.update({ isPublished: true });
    expect(await itemIds(student)).toEqual([a.id]);
  });

  it("loses the save when the resource is deleted", async () => {
    const student = await user("student", "s@example.com");
    const { a } = await seed();
    await saveResource(student, a.id);
    await a.destroy();
    expect(await listSavedResources(student)).toEqual([]);
    expect(await getDb().Bookmark.count()).toBe(0);
  });

  it("never shows another user's saves", async () => {
    const one = await user("student", "one@example.com");
    const two = await user("student", "two@example.com");
    const { a, b } = await seed();
    await saveResource(one, a.id);
    await saveResource(two, b.id);
    expect(await itemIds(one)).toEqual([a.id]);
    expect(await itemIds(two)).toEqual([b.id]);
  });
});

describe("listSavedResourceIds", () => {
  it("never shows another user's saves", async () => {
    const one = await user("student", "one@example.com");
    const two = await user("student", "two@example.com");
    const { a, b } = await seed();
    await saveResource(one, a.id);
    await saveResource(two, b.id);
    expect(await listSavedResourceIds(one)).toEqual([a.id]);
    expect(await listSavedResourceIds(two)).toEqual([b.id]);
  });

  it("drops a resource that is no longer published, and brings it back when republished", async () => {
    const student = await user("student", "s@example.com");
    const { a, b } = await seed();
    await saveResource(student, a.id);
    await saveResource(student, b.id);
    await a.update({ isPublished: false });
    expect(await listSavedResourceIds(student)).toEqual([b.id]);
    await a.update({ isPublished: true });
    expect([...(await listSavedResourceIds(student))].sort()).toEqual([a.id, b.id].sort());
  });
});

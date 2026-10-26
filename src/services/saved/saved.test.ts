import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { UserRole } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { NotFoundError } from "../errors";
import type { Viewer } from "../viewer";
import { listSavedResourceIds, saveResource, unsaveResource } from "./saved";

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

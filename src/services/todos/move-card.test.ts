import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { NotFoundError, ValidationError } from "../errors";
import type { Viewer } from "../viewer";
import { createCard, deleteCard, listBoard, moveCard } from "./todos";

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeDb();
});

async function student(email: string): Promise<NonNullable<Viewer>> {
  const row = await getDb().User.create({ email, passwordHash: "not-a-real-hash", role: "student" });
  return { id: row.id, role: row.role };
}

// Three cards per column, t1..t3 (t1 on top), p1..p3 and d1..d3.
async function filled() {
  const me = await student("a@example.com");
  const ids: Record<string, string> = {};
  for (const [status, prefix] of [["todo", "t"], ["in_progress", "p"], ["done", "d"]] as const) {
    for (const n of [3, 2, 1]) ids[`${prefix}${n}`] = (await createCard(me, { title: `${prefix}${n}`, status })).id;
  }
  return { me, ids };
}

const column = async (me: NonNullable<Viewer>, status: string) =>
  (await listBoard(me)).filter((c) => c.status === status).map((c) => c.title);

describe("moveCard", () => {
  it("moves a card to the top, the middle or the end of another column", async () => {
    const { me, ids } = await filled();
    await moveCard(me, ids.t1, { status: "in_progress", index: 0 });
    expect(await column(me, "in_progress")).toEqual(["t1", "p1", "p2", "p3"]);
    await moveCard(me, ids.t2, { status: "in_progress", index: 2 });
    expect(await column(me, "in_progress")).toEqual(["t1", "p1", "t2", "p2", "p3"]);
    await moveCard(me, ids.t3, { status: "in_progress", index: 5 });
    expect(await column(me, "in_progress")).toEqual(["t1", "p1", "t2", "p2", "p3", "t3"]);
    expect(await column(me, "todo")).toEqual([]);
  });

  it("clamps an index beyond the column's length to the end", async () => {
    const { me, ids } = await filled();
    const card = await moveCard(me, ids.t1, { status: "done", index: 999 });
    expect(card).toMatchObject({ status: "done", position: 3 });
    expect(await column(me, "done")).toEqual(["d1", "d2", "d3", "t1"]);
    expect(await column(me, "todo")).toEqual(["t2", "t3"]);
  });

  it("moves a card up and down within its column", async () => {
    const { me, ids } = await filled();
    await moveCard(me, ids.t1, { status: "todo", index: 1 });
    expect(await column(me, "todo")).toEqual(["t2", "t1", "t3"]);
    await moveCard(me, ids.t3, { status: "todo", index: 0 });
    expect(await column(me, "todo")).toEqual(["t3", "t2", "t1"]);
    await moveCard(me, ids.t3, { status: "todo", index: 50 });
    expect(await column(me, "todo")).toEqual(["t2", "t1", "t3"]);
  });

  it("keeps every column gapless through a series of moves", async () => {
    const { me, ids } = await filled();
    const steps: [string, "todo" | "in_progress" | "done", number][] = [
      ["t2", "done", 0], ["p1", "todo", 1], ["d3", "in_progress", 2], ["t1", "todo", 0], ["p3", "done", 9], ["d1", "todo", 0],
    ];
    for (const [key, status, index] of steps) await moveCard(me, ids[key], { status, index });
    const board = await listBoard(me);
    expect(board).toHaveLength(9);
    for (const status of ["todo", "in_progress", "done"]) {
      const positions = board.filter((c) => c.status === status).map((c) => c.position);
      expect(positions).toEqual(positions.map((_, i) => i));
    }
  });

  it("changes statusChangedAt only when the status changes", async () => {
    const { me, ids } = await filled();
    const old = new Date("2026-01-01T00:00:00Z");
    await getDb().Todo.update({ statusChangedAt: old }, { where: { userId: me.id } });
    const within = await moveCard(me, ids.t1, { status: "todo", index: 2 });
    expect(within.statusChangedAt).toBe(old.toISOString());
    const across = await moveCard(me, ids.t1, { status: "done", index: 0 });
    expect(Date.parse(across.statusChangedAt)).toBeGreaterThan(old.getTime());
    expect(Date.parse(across.updatedAt)).toBeGreaterThanOrEqual(Date.parse(within.updatedAt));
  });

  it("does nothing when the card is already in that place", async () => {
    const { me, ids } = await filled();
    const before = await listBoard(me);
    const card = await moveCard(me, ids.t2, { status: "todo", index: 1 });
    expect(card.id).toBe(ids.t2);
    expect(await listBoard(me)).toEqual(before);
  });

  it("never touches completions, also when a card reaches Done", async () => {
    const { me, ids } = await filled();
    const { Completion, Resource, Course } = getDb();
    const course = await Course.create({ code: "DEMO301", title: "Placeholder", semester: 3 });
    const resource = await Resource.create({ courseId: course.id, type: "lecture", title: "Fake", fileKey: "k", isPublished: true });
    await Completion.create({ userId: me.id, resourceId: resource.id });
    const before = await Completion.findAll({ raw: true });
    await moveCard(me, ids.t1, { status: "in_progress", index: 0 });
    await moveCard(me, ids.t1, { status: "done", index: 0 });
    await moveCard(me, ids.t1, { status: "todo", index: 0 });
    expect(await Completion.findAll({ raw: true })).toEqual(before);
    expect(before).toHaveLength(1);
  });

  it("does not find another user's, a deleted or a malformed card", async () => {
    const { me, ids } = await filled();
    const other = await student("b@example.com");
    await expect(moveCard(other, ids.t1, { status: "done", index: 0 })).rejects.toBeInstanceOf(NotFoundError);
    await deleteCard(me, ids.t1);
    await expect(moveCard(me, ids.t1, { status: "done", index: 0 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(moveCard(me, "not-an-id", { status: "done", index: 0 })).rejects.toBeInstanceOf(NotFoundError);
    expect(await column(me, "done")).toEqual(["d1", "d2", "d3"]);
  });

  it("refuses an unknown status and a negative, fractional or missing index", async () => {
    const { me, ids } = await filled();
    await expect(moveCard(me, ids.t1, { status: "later" as never, index: 0 })).rejects.toMatchObject({ fields: ["status"] });
    await expect(moveCard(me, ids.t1, { status: "done", index: -1 })).rejects.toMatchObject({ fields: ["index"] });
    await expect(moveCard(me, ids.t1, { status: "done", index: 1.5 })).rejects.toMatchObject({ fields: ["index"] });
    await expect(moveCard(me, ids.t1, { status: "done" } as never)).rejects.toBeInstanceOf(ValidationError);
  });
});

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TODO_MAX_CARDS } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { BoardFullError, ValidationError } from "../errors";
import type { Viewer } from "../viewer";
import { createCard, deleteCard, listBoard, restoreCard, updateCard } from "./todos";

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

const positions = async (viewer: NonNullable<Viewer>, status: string) =>
  (await listBoard(viewer)).filter((c) => c.status === status).map((c) => [c.title, c.position]);

describe("createCard", () => {
  it("defaults to To do and returns the card", async () => {
    const me = await student("a@example.com");
    const card = await createCard(me, { title: "Revise chapter 1" });
    expect(card).toMatchObject({ status: "todo", position: 0, title: "Revise chapter 1", note: "" });
    expect(Date.parse(card.statusChangedAt)).not.toBeNaN();
    expect(Date.parse(card.createdAt)).not.toBeNaN();
  });

  it("puts the new card at the top and shifts the others down, per column and without gaps", async () => {
    const me = await student("a@example.com");
    await createCard(me, { title: "one" });
    await createCard(me, { title: "two" });
    await createCard(me, { title: "busy", status: "in_progress" });
    await createCard(me, { title: "three" });
    expect(await positions(me, "todo")).toEqual([["three", 0], ["two", 1], ["one", 2]]);
    expect(await positions(me, "in_progress")).toEqual([["busy", 0]]);
  });

  it("trims the title and keeps the note", async () => {
    const me = await student("a@example.com");
    const card = await createCard(me, { title: "  spaced  ", note: "details", status: "done" });
    expect(card).toMatchObject({ title: "spaced", note: "details", status: "done" });
  });

  it("requires a title of 1 to 200 characters", async () => {
    const me = await student("a@example.com");
    for (const title of ["", "   "]) {
      await expect(createCard(me, { title })).rejects.toMatchObject({ name: "ValidationError", fields: ["title"] });
    }
    await expect(createCard(me, { title: "x".repeat(201) })).rejects.toBeInstanceOf(ValidationError);
    await expect(createCard(me, {} as never)).rejects.toMatchObject({ fields: ["title"] });
    await expect(createCard(me, { title: "x".repeat(200) })).resolves.toMatchObject({ title: "x".repeat(200) });
  });

  it("limits the note to 2000 characters and the status to the three columns", async () => {
    const me = await student("a@example.com");
    await expect(createCard(me, { title: "t", note: "n".repeat(2000) })).resolves.toBeDefined();
    await expect(createCard(me, { title: "t", note: "n".repeat(2001) })).rejects.toMatchObject({ fields: ["note"] });
    await expect(createCard(me, { title: "t", status: "later" as never })).rejects.toMatchObject({ fields: ["status"] });
  });

  it("refuses the 501st live card but ignores deleted ones", async () => {
    const me = await student("a@example.com");
    const { Todo } = getDb();
    const rows = (count: number, deletedAt: Date | null) =>
      Array.from({ length: count }, (_, i) => ({ userId: me.id, status: "done" as const, position: i, title: `c${i}`, deletedAt }));
    await Todo.bulkCreate(rows(TODO_MAX_CARDS - 1, null));
    await Todo.bulkCreate(rows(5, new Date()));
    await expect(createCard(me, { title: "last" })).resolves.toBeDefined();
    await expect(createCard(me, { title: "one too many" })).rejects.toBeInstanceOf(BoardFullError);
    expect(await Todo.count({ where: { userId: me.id, deletedAt: null } })).toBe(TODO_MAX_CARDS);
  });

  it("keeps positions unique when cards are created at the same moment", async () => {
    const me = await student("a@example.com");
    await Promise.all(["a", "b", "c", "d", "e"].map((title) => createCard(me, { title })));
    const board = await listBoard(me);
    expect(board.map((c) => c.position)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("listBoard", () => {
  it("returns only the viewer's cards, columns in order and cards top to bottom", async () => {
    const me = await student("a@example.com");
    const other = await student("b@example.com");
    await createCard(me, { title: "d1", status: "done" });
    await createCard(me, { title: "t1" });
    await createCard(me, { title: "p1", status: "in_progress" });
    await createCard(me, { title: "t2" });
    await createCard(other, { title: "not mine" });
    expect((await listBoard(me)).map((c) => c.title)).toEqual(["t2", "t1", "p1", "d1"]);
    expect((await listBoard(other)).map((c) => c.title)).toEqual(["not mine"]);
  });

  it("is empty for a new student", async () => {
    expect(await listBoard(await student("a@example.com"))).toEqual([]);
  });

  it("hides deleted cards, and purges this user's ones deleted more than a day ago", async () => {
    const me = await student("a@example.com");
    const other = await student("b@example.com");
    const { Todo } = getDb();
    const hour = 60 * 60 * 1000;
    const dead = (userId: string, title: string, ago: number) => ({
      userId, status: "todo" as const, position: 0, title, deletedAt: new Date(Date.now() - ago),
    });
    await Todo.bulkCreate([dead(me.id, "recent", hour), dead(me.id, "old", 25 * hour), dead(other.id, "others old", 25 * hour)]);
    await createCard(me, { title: "live" });
    expect((await listBoard(me)).map((c) => c.title)).toEqual(["live"]);
    const left = (await Todo.findAll({ attributes: ["title"] })).map((r) => r.title).sort();
    // The recent soft delete stays for Undo; another user's old one is only purged on their own load.
    expect(left).toEqual(["live", "others old", "recent"]);
  });
});

describe("updateCard", () => {
  it("changes the title and note, trims the title and keeps what was not sent", async () => {
    const me = await student("a@example.com");
    const card = await createCard(me, { title: "old", note: "keep me" });
    const edited = await updateCard(me, card.id, { title: "  new  " });
    expect(edited).toMatchObject({ title: "new", note: "keep me" });
    await updateCard(me, card.id, { note: "second" });
    expect((await listBoard(me))[0]).toMatchObject({ title: "new", note: "second" });
    expect(Date.parse(edited.updatedAt)).toBeGreaterThanOrEqual(Date.parse(card.updatedAt));
  });

  it("refuses an empty title on a card with no file, and a note over 2000 characters", async () => {
    const me = await student("a@example.com");
    const card = await createCard(me, { title: "keep" });
    for (const title of ["", "   "]) {
      await expect(updateCard(me, card.id, { title })).rejects.toMatchObject({ name: "ValidationError", fields: ["title"] });
    }
    await expect(updateCard(me, card.id, { note: "n".repeat(2001) })).rejects.toMatchObject({ fields: ["note"] });
    await expect(updateCard(me, card.id, { title: "x".repeat(201) })).rejects.toMatchObject({ fields: ["title"] });
    await expect(updateCard(me, card.id, { note: "n".repeat(2000) })).resolves.toBeDefined();
    expect((await listBoard(me))[0].title).toBe("keep");
  });

  it("allows an empty title when a file is linked", async () => {
    const me = await student("a@example.com");
    const { Todo, Course, Resource } = getDb();
    const course = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
    const resource = await Resource.create({ courseId: course.id, type: "lecture", title: "Slides", fileKey: "k", isPublished: true });
    const row = await Todo.create({ userId: me.id, position: 0, title: "t", resourceId: resource.id });
    await expect(updateCard(me, row.id, { title: "" })).resolves.toMatchObject({ title: "" });
  });

  it("treats another user's, an unknown, a malformed and a deleted card as not found", async () => {
    const me = await student("a@example.com");
    const other = await student("b@example.com");
    const theirs = await createCard(other, { title: "theirs" });
    const mine = await createCard(me, { title: "mine" });
    await deleteCard(me, mine.id);
    for (const id of [theirs.id, "00000000-0000-4000-8000-000000000000", "not-an-id", mine.id]) {
      await expect(updateCard(me, id, { title: "x" })).rejects.toMatchObject({ name: "NotFoundError", message: "Card not found" });
    }
    expect((await listBoard(other))[0].title).toBe("theirs");
  });
});

describe("deleteCard and restoreCard", () => {
  // Creates a, b, c (top to bottom, positions 0..2) and returns them in that order.
  async function three(me: NonNullable<Viewer>) {
    await createCard(me, { title: "c" });
    await createCard(me, { title: "b" });
    await createCard(me, { title: "a" });
    return listBoard(me);
  }

  it("hides the card and closes the gap", async () => {
    const me = await student("a@example.com");
    const [, middle] = await three(me);
    await deleteCard(me, middle.id);
    expect(await positions(me, "todo")).toEqual([["a", 0], ["c", 1]]);
    const row = await getDb().Todo.findByPk(middle.id);
    expect(row).toMatchObject({ status: "todo", position: 1 });
    expect(row?.deletedAt).toBeInstanceOf(Date);
  });

  it("is idempotent, and does not move other cards a second time", async () => {
    const me = await student("a@example.com");
    const [, middle] = await three(me);
    await deleteCard(me, middle.id);
    await expect(deleteCard(me, middle.id)).resolves.toBeUndefined();
    expect(await positions(me, "todo")).toEqual([["a", 0], ["c", 1]]);
  });

  it("restores into the same column and place, putting the others back", async () => {
    const me = await student("a@example.com");
    const [, middle] = await three(me);
    await deleteCard(me, middle.id);
    const back = await restoreCard(me, middle.id);
    expect(back).toMatchObject({ title: "b", status: "todo", position: 1 });
    expect(await positions(me, "todo")).toEqual([["a", 0], ["b", 1], ["c", 2]]);
  });

  it("restores the first and the last card too", async () => {
    const me = await student("a@example.com");
    const [first, , last] = await three(me);
    await deleteCard(me, first.id);
    await deleteCard(me, last.id);
    await restoreCard(me, last.id);
    await restoreCard(me, first.id);
    expect(await positions(me, "todo")).toEqual([["a", 0], ["b", 1], ["c", 2]]);
  });

  it("clamps to the bottom when the column has become shorter", async () => {
    const me = await student("a@example.com");
    const [first, , last] = await three(me);
    await deleteCard(me, last.id);
    await deleteCard(me, first.id);
    // Only "b" is left; "c" was at 2 and goes to the end, not into a gap.
    const back = await restoreCard(me, last.id);
    expect(back.position).toBe(1);
    expect(await positions(me, "todo")).toEqual([["b", 0], ["c", 1]]);
  });

  it("restoring a live card does nothing", async () => {
    const me = await student("a@example.com");
    const [first] = await three(me);
    await expect(restoreCard(me, first.id)).resolves.toMatchObject({ id: first.id, position: 0 });
    expect(await positions(me, "todo")).toEqual([["a", 0], ["b", 1], ["c", 2]]);
  });

  it("refuses to restore into a full board", async () => {
    const me = await student("a@example.com");
    const card = await createCard(me, { title: "gone" });
    await deleteCard(me, card.id);
    await getDb().Todo.bulkCreate(
      Array.from({ length: TODO_MAX_CARDS }, (_, i) => ({ userId: me.id, status: "done" as const, position: i, title: `c${i}` })),
    );
    await expect(restoreCard(me, card.id)).rejects.toBeInstanceOf(BoardFullError);
    expect(await getDb().Todo.count({ where: { userId: me.id, deletedAt: null } })).toBe(TODO_MAX_CARDS);
  });

  it("cannot restore a purged card, another user's card or a malformed id", async () => {
    const me = await student("a@example.com");
    const other = await student("b@example.com");
    const card = await createCard(me, { title: "old" });
    await deleteCard(me, card.id);
    await expect(restoreCard(other, card.id)).rejects.toMatchObject({ name: "NotFoundError" });
    await expect(restoreCard(me, "nope")).rejects.toMatchObject({ name: "NotFoundError" });
    await getDb().Todo.update({ deletedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) }, { where: { id: card.id } });
    await expect(restoreCard(me, card.id)).rejects.toMatchObject({ name: "NotFoundError" });
    await listBoard(me);
    expect(await getDb().Todo.count()).toBe(0);
    await expect(restoreCard(me, card.id)).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("another user's card cannot be deleted", async () => {
    const me = await student("a@example.com");
    const other = await student("b@example.com");
    const theirs = await createCard(other, { title: "theirs" });
    await expect(deleteCard(me, theirs.id)).rejects.toMatchObject({ name: "NotFoundError" });
    expect(await listBoard(other)).toHaveLength(1);
  });
});

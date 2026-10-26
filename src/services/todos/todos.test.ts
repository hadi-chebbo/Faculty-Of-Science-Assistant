import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TODO_MAX_CARDS } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { BoardFullError, ValidationError } from "../errors";
import type { Viewer } from "../viewer";
import { createCard, listBoard } from "./todos";

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

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
    const { card } = await moveCard(me, ids.t1, { status: "done", index: 999 });
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
    const { card: within } = await moveCard(me, ids.t1, { status: "todo", index: 2 });
    expect(within.statusChangedAt).toBe(old.toISOString());
    const { card: across } = await moveCard(me, ids.t1, { status: "done", index: 0 });
    expect(Date.parse(across.statusChangedAt)).toBeGreaterThan(old.getTime());
    expect(Date.parse(across.updatedAt)).toBeGreaterThanOrEqual(Date.parse(within.updatedAt));
  });

  it("does nothing when the card is already in that place", async () => {
    const { me, ids } = await filled();
    const before = await listBoard(me);
    const result = await moveCard(me, ids.t2, { status: "todo", index: 1 });
    expect(result).toMatchObject({ fileMarked: false, rewards: null, progress: null });
    expect(result.card.id).toBe(ids.t2);
    expect(await listBoard(me)).toEqual(before);
  });

  it("marks nothing for cards without a file, with an unpublished file or with a solution", async () => {
    const { me, ids } = await filled();
    const { Completion, Resource, Course } = getDb();
    const course = await Course.create({ code: "DEMO301", title: "Placeholder", semester: 3 });
    const make = (type: "lecture" | "solution", isPublished: boolean) =>
      Resource.create({ courseId: course.id, type, title: "Fake", fileKey: "k", isPublished });
    const hidden = await make("lecture", true);
    const solution = await make("solution", true);
    const cardOf = async (resourceId: string) => (await createCard(me, { title: "f", resourceId })).id;
    const hiddenCard = await cardOf(hidden.id);
    const solutionCard = await cardOf(solution.id);
    await hidden.update({ isPublished: false });
    for (const id of [ids.t1, hiddenCard, solutionCard]) {
      const result = await moveCard(me, id, { status: "done", index: 0 });
      expect(result).toMatchObject({ fileMarked: false, rewards: null, progress: null });
    }
    expect(await Completion.count()).toBe(0);
  });

  it("changes no completion on moves between To do and In progress, within Done or out of Done", async () => {
    const { me } = await filled();
    const { Completion, Resource, Course } = getDb();
    const course = await Course.create({ code: "DEMO301", title: "Placeholder", semester: 3 });
    const file = await Resource.create({ courseId: course.id, type: "lecture", title: "Fake", fileKey: "k", isPublished: true });
    const card = await createCard(me, { title: "f", resourceId: file.id });
    expect((await moveCard(me, card.id, { status: "in_progress", index: 0 })).fileMarked).toBe(false);
    expect(await Completion.count()).toBe(0);
    expect((await moveCard(me, card.id, { status: "done", index: 0 })).fileMarked).toBe(true);
    expect(await Completion.count()).toBe(1);
    // Within Done and out of Done: the completion stays, nothing is marked or removed.
    for (const [status, index] of [["done", 2], ["todo", 0], ["in_progress", 0], ["todo", 0]] as const) {
      const result = await moveCard(me, card.id, { status, index });
      expect(result).toMatchObject({ fileMarked: false, rewards: null, progress: null });
      expect(await Completion.count()).toBe(1);
    }
  });

  describe("entering Done with a linked file", () => {
    async function course() {
      const { Course, Chapter, Resource } = getDb();
      const c = await Course.create({ code: "DEMO301", title: "Placeholder", semester: 3 });
      const chapter = await Chapter.create({ courseId: c.id, position: 1, title: "Basics" });
      const make = (title: string, type: "lecture" | "exam" = "lecture") =>
        Resource.create({ courseId: c.id, chapterId: type === "exam" ? null : chapter.id, type, title, fileKey: "k", isPublished: true, ...(type === "exam" ? { examSession: "final" as const, academicYearStart: 2024 } : {}) });
      return { make };
    }

    it("marks the file in the same move: completion, active day, progress and rewards", async () => {
      const { me } = await filled();
      const { make } = await course();
      const a = await make("A");
      const b = await make("B");
      const cardA = await createCard(me, { title: "a", resourceId: a.id });
      const cardB = await createCard(me, { title: "b", resourceId: b.id });
      const first = await moveCard(me, cardA.id, { status: "done", index: 0 });
      expect(first.fileMarked).toBe(true);
      expect(first.card.resource).toMatchObject({ available: true, id: a.id, done: true });
      expect(first.progress).toMatchObject({ course: { code: "DEMO301", done: 1, total: 2 }, chapter: { done: 1, total: 2 } });
      expect(first.rewards?.chapterFinished).toBeNull();
      expect(first.rewards?.milestones).toContain("first_file");
      expect(await getDb().Completion.count({ where: { userId: me.id, resourceId: a.id } })).toBe(1);
      expect(await getDb().StudyDay.count({ where: { userId: me.id } })).toBe(1);
      // The second file finishes the chapter and the course.
      const second = await moveCard(me, cardB.id, { status: "done", index: 0 });
      expect(second.rewards?.chapterFinished).toMatchObject({ position: 1, title: "Basics", nextChapter: null });
      expect(second.rewards?.courseFinished).toMatchObject({ code: "DEMO301", filesTotal: 2 });
    });

    it("marks an exam, counted apart", async () => {
      const { me } = await filled();
      const { make } = await course();
      const exam = await make("Exam", "exam");
      const card = await createCard(me, { title: "e", resourceId: exam.id });
      const result = await moveCard(me, card.id, { status: "done", index: 0 });
      expect(result).toMatchObject({ fileMarked: true, progress: { exams: { done: 1, total: 1 }, chapter: null } });
    });

    it("answers fileMarked false and adds no duplicate when the file was already done", async () => {
      const { me } = await filled();
      const { make } = await course();
      const file = await make("A");
      await getDb().Completion.create({ userId: me.id, resourceId: file.id });
      const card = await createCard(me, { title: "a", resourceId: file.id });
      const result = await moveCard(me, card.id, { status: "done", index: 0 });
      expect(result).toMatchObject({ fileMarked: false, card: { resource: { done: true } } });
      expect(result.rewards).toEqual({ milestones: [], chapterFinished: null, courseFinished: null });
      expect(await getDb().Completion.count()).toBe(1);
      expect(await getDb().StudyDay.count()).toBe(0);
    });

    it("leaves the file done when the card moves out of Done", async () => {
      const { me } = await filled();
      const { make } = await course();
      const file = await make("A");
      const card = await createCard(me, { title: "a", resourceId: file.id });
      await moveCard(me, card.id, { status: "done", index: 0 });
      const out = await moveCard(me, card.id, { status: "todo", index: 0 });
      expect(out.card.resource).toMatchObject({ done: true });
      expect(await getDb().Completion.count()).toBe(1);
    });
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

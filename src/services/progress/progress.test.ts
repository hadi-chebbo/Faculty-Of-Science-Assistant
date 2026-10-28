import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MILESTONE_KEYS, type MilestoneKey, type ResourceType } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { NotFoundError } from "../errors";
import type { Viewer } from "../viewer";
import { getCourseProgress, getProgressOverview, listCompletedIds, markDone, unmarkDone } from "./progress";

const MISSING_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeDb();
});

async function user(email = "s@example.com"): Promise<NonNullable<Viewer>> {
  const row = await getDb().User.create({ email, passwordHash: "not-a-real-hash", role: "student" });
  return { id: row.id, role: row.role };
}

// A course with two chapters: chapter 1 holds two lectures and an exercise with its solution,
// chapter 2 one note; General holds a lecture and an "other" file; and there are two exams.
async function seed() {
  const { Course, Chapter, Resource } = getDb();
  const course = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
  const one = await Chapter.create({ courseId: course.id, position: 1, title: "Basics" });
  const two = await Chapter.create({ courseId: course.id, position: 2, title: "Sorting" });
  const make = (type: ResourceType, title: string, chapterId: string | null, isPublished = true) =>
    Resource.create({
      courseId: course.id, chapterId, type, title, fileKey: "k", isPublished,
      ...(type === "exam" ? { examSession: "final" as const, academicYearStart: 2024 } : {}),
    });
  const lecture1 = await make("lecture", "L1", one.id);
  const lecture2 = await make("lecture", "L2", one.id);
  const exercise = await make("exercise", "E1", one.id);
  const solution = await Resource.create({
    courseId: course.id, chapterId: one.id, type: "solution", title: "E1 sol", fileKey: "k", isPublished: true, solutionOfId: exercise.id,
  });
  const notes = await make("notes", "N2", two.id);
  const general = await make("lecture", "G", null);
  const other = await make("other", "O", null);
  const draft = await make("lecture", "Draft", one.id, false);
  const exam1 = await make("exam", "X1", null);
  const exam2 = await make("exam", "X2", null);
  return { course, one, two, lecture1, lecture2, exercise, solution, notes, general, other, draft, exam1, exam2 };
}

describe("markDone", () => {
  it("records the completion and returns the chapter, course and exam progress", async () => {
    const student = await user();
    const s = await seed();
    const result = await markDone(student, s.lecture1.id);
    expect(result).toEqual({
      created: true,
      progress: {
        course: { code: "TEST301", done: 1, total: 5, finished: false },
        exams: { done: 0, total: 2 },
        chapter: { id: s.one.id, position: 1, title: "Basics", done: 1, total: 3, finished: false },
      },
      rewards: { milestones: ["first_file"], chapterFinished: null, courseFinished: null },
    });
    expect(await listCompletedIds(student)).toEqual([s.lecture1.id]);
  });

  it("is idempotent: a second mark reports created false and counts once", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id);
    const again = await markDone(student, s.lecture1.id);
    expect(again.created).toBe(false);
    expect(again.progress.chapter).toMatchObject({ done: 1, total: 3 });
    expect(await getDb().Completion.count()).toBe(1);
  });

  it("survives two marks at the same moment", async () => {
    const student = await user();
    const s = await seed();
    const results = await Promise.all([markDone(student, s.lecture1.id), markDone(student, s.lecture1.id)]);
    expect(results.map((r) => r.created).sort()).toEqual([false, true]);
    expect(await getDb().Completion.count()).toBe(1);
  });

  it("refuses a solution, an other file, a draft (even for the admin), and an unknown or malformed id", async () => {
    const admin = { ...(await user("a@example.com")), role: "admin" as const };
    const s = await seed();
    for (const id of [s.solution.id, s.other.id, s.draft.id, MISSING_ID, "not-a-uuid"]) {
      await expect(markDone(admin, id)).rejects.toBeInstanceOf(NotFoundError);
    }
    expect(await getDb().Completion.count()).toBe(0);
  });

  it("counts an exam apart, with no chapter", async () => {
    const student = await user();
    const s = await seed();
    const { progress } = await markDone(student, s.exam1.id);
    expect(progress).toEqual({
      course: { code: "TEST301", done: 0, total: 5, finished: false },
      exams: { done: 1, total: 2 },
      chapter: null,
    });
  });

  it("counts a file in General in the course, with no chapter", async () => {
    const student = await user();
    const s = await seed();
    const { progress } = await markDone(student, s.general.id);
    expect(progress.course).toMatchObject({ done: 1, total: 5 });
    expect(progress.chapter).toBeNull();
  });

  it("finishes a chapter and the course exactly at their last counted file", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id);
    await markDone(student, s.lecture2.id);
    const chapterDone = await markDone(student, s.exercise.id);
    expect(chapterDone.progress.chapter).toMatchObject({ done: 3, total: 3, finished: true });
    expect(chapterDone.progress.course.finished).toBe(false);
    await markDone(student, s.notes.id);
    const courseDone = await markDone(student, s.general.id);
    expect(courseDone.progress.course).toEqual({ code: "TEST301", done: 5, total: 5, finished: true });
    // Exams never make the course figure, finished or not.
    expect(courseDone.progress.exams).toEqual({ done: 0, total: 2 });
  });

  it("un-finishes a chapter when a new counted file is published in it", async () => {
    const student = await user();
    const s = await seed();
    const { progress } = await markDone(student, s.notes.id);
    expect(progress.chapter).toMatchObject({ done: 1, total: 1, finished: true });
    await getDb().Resource.create({ courseId: s.course.id, chapterId: s.two.id, type: "exercise", title: "New", fileKey: "k", isPublished: true });
    expect((await markDone(student, s.notes.id)).progress.chapter).toMatchObject({ done: 1, total: 2, finished: false });
  });

  it("leaves an unpublished file out of both numbers, and counts the mark again when it is republished", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id);
    await s.lecture1.update({ isPublished: false });
    expect((await markDone(student, s.lecture2.id)).progress.chapter).toMatchObject({ done: 1, total: 2 });
    expect(await listCompletedIds(student)).toEqual([s.lecture2.id]);
    await s.lecture1.update({ isPublished: true });
    expect((await markDone(student, s.lecture2.id)).progress.chapter).toMatchObject({ done: 2, total: 3 });
    expect([...(await listCompletedIds(student))].sort()).toEqual([s.lecture1.id, s.lecture2.id].sort());
  });

  it("never counts another student's completions", async () => {
    const one = await user("one@example.com");
    const two = await user("two@example.com");
    const s = await seed();
    await markDone(one, s.lecture1.id);
    expect((await markDone(two, s.lecture2.id)).progress.chapter).toMatchObject({ done: 1 });
    expect(await listCompletedIds(one)).toEqual([s.lecture1.id]);
    expect(await listCompletedIds(two)).toEqual([s.lecture2.id]);
  });
});

describe("unmarkDone", () => {
  it("removes the completion and returns the new progress, and succeeds when nothing was marked", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id);
    const { progress } = await unmarkDone(student, s.lecture1.id);
    expect(progress?.chapter).toMatchObject({ done: 0, total: 3 });
    expect(await unmarkDone(student, s.lecture1.id)).toMatchObject({ progress: { course: { done: 0 } } });
    expect(await listCompletedIds(student)).toEqual([]);
  });

  it("works on a file that is no longer published", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id);
    await s.lecture1.update({ isPublished: false });
    await unmarkDone(student, s.lecture1.id);
    await s.lecture1.update({ isPublished: true });
    expect(await listCompletedIds(student)).toEqual([]);
  });

  it("rejects a malformed id and works for an unknown one", async () => {
    const student = await user();
    await expect(unmarkDone(student, "nope")).rejects.toBeInstanceOf(NotFoundError);
    await expect(unmarkDone(student, MISSING_ID)).resolves.toEqual({ progress: null });
  });

  it("only touches the viewer's own completion", async () => {
    const one = await user("one@example.com");
    const two = await user("two@example.com");
    const s = await seed();
    await markDone(one, s.lecture1.id);
    await markDone(two, s.lecture1.id);
    await unmarkDone(one, s.lecture1.id);
    expect(await listCompletedIds(one)).toEqual([]);
    expect(await listCompletedIds(two)).toEqual([s.lecture1.id]);
  });
});

describe("listCompletedIds", () => {
  it("loses the completion when the file is deleted", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.general.id);
    await s.general.destroy();
    expect(await listCompletedIds(student)).toEqual([]);
    expect(await getDb().Completion.count()).toBe(0);
  });
});

describe("getCourseProgress", () => {
  it("counts lectures, notes and exercises; exams apart; solutions and other files nowhere", async () => {
    const student = await user();
    const s = await seed();
    await getDb().Chapter.create({ courseId: s.course.id, position: 3, title: "Empty" });
    expect(await getCourseProgress(student, "TEST301")).toEqual({
      course: { code: "TEST301", title: "Course A", done: 0, total: 5, finished: false },
      exams: { done: 0, total: 2 },
      chapters: [
        { id: s.one.id, position: 1, title: "Basics", done: 0, total: 3, finished: false },
        { id: s.two.id, position: 2, title: "Sorting", done: 0, total: 1, finished: false },
        expect.objectContaining({ position: 3, title: "Empty", done: 0, total: 0, finished: false }),
      ],
      general: { done: 0, total: 1, finished: false },
    });
  });

  it("counts marks in the chapter, General, exams and the course", async () => {
    const student = await user();
    const s = await seed();
    for (const file of [s.lecture1, s.general, s.exam1]) await markDone(student, file.id);
    const progress = await getCourseProgress(student, "TEST301");
    expect(progress.course).toMatchObject({ done: 2, total: 5 });
    expect(progress.exams).toEqual({ done: 1, total: 2 });
    expect(progress.chapters[0]).toMatchObject({ done: 1, total: 3 });
    expect(progress.general).toEqual({ done: 1, total: 1, finished: true });
  });

  it("finishes exactly at the last counted file, and a new published file un-finishes", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id);
    await markDone(student, s.lecture2.id);
    expect((await getCourseProgress(student, "TEST301")).chapters[0].finished).toBe(false);
    await markDone(student, s.exercise.id);
    expect((await getCourseProgress(student, "TEST301")).chapters[0]).toMatchObject({ done: 3, total: 3, finished: true });
    await getDb().Resource.create({ courseId: s.course.id, chapterId: s.one.id, type: "notes", title: "New", fileKey: "k", isPublished: true });
    expect((await getCourseProgress(student, "TEST301")).chapters[0]).toMatchObject({ done: 3, total: 4, finished: false });
  });

  it("drops an unpublished file from both numbers and brings the mark back when republished", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id);
    await s.lecture1.update({ isPublished: false });
    expect((await getCourseProgress(student, "TEST301")).chapters[0]).toMatchObject({ done: 0, total: 2 });
    await s.lecture1.update({ isPublished: true });
    expect((await getCourseProgress(student, "TEST301")).chapters[0]).toMatchObject({ done: 1, total: 3 });
  });

  it("never counts another student's completions, and gives the admin the same figures", async () => {
    const one = await user("one@example.com");
    const admin = { ...(await user("a@example.com")), role: "admin" as const };
    const s = await seed();
    await markDone(one, s.lecture1.id);
    expect((await getCourseProgress(admin, "TEST301")).course).toMatchObject({ done: 0, total: 5 });
    expect((await getCourseProgress(one, "TEST301")).course).toMatchObject({ done: 1, total: 5 });
  });

  it("is not found for an unknown code", async () => {
    await expect(getCourseProgress(await user(), "NOPE")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("getProgressOverview", () => {
  it("is empty when nothing is marked", async () => {
    const student = await user();
    await seed();
    expect((await getProgressOverview(student)).courses).toEqual([]);
  });

  it("lists only My courses, by semester then code, with the same figures as the course page", async () => {
    const { Course, Resource } = getDb();
    const student = await user();
    const s = await seed();
    const early = await Course.create({ code: "TEST302", title: "Course B", semester: 3 });
    const late = await Course.create({ code: "TEST501", title: "Course C", semester: 5 });
    await Course.create({ code: "TEST303", title: "Untouched", semester: 3 });
    const earlyLecture = await Resource.create({ courseId: early.id, type: "lecture", title: "A", fileKey: "k", isPublished: true });
    const lateLecture = await Resource.create({ courseId: late.id, type: "lecture", title: "A", fileKey: "k", isPublished: true });
    await markDone(student, lateLecture.id);
    await markDone(student, earlyLecture.id);
    await markDone(student, s.lecture1.id);
    await markDone(student, s.exam1.id);

    const { courses } = await getProgressOverview(student);
    expect(courses.map((c) => c.code)).toEqual(["TEST301", "TEST302", "TEST501"]);
    expect(courses[0]).toMatchObject({ title: "Course A", semester: 3, exams: { done: 1, total: 2 }, course: { done: 1, total: 5, finished: false } });
    expect(courses[0].chapters).toEqual([
      { id: s.one.id, position: 1, title: "Basics", done: 1, total: 3, finished: false },
      { id: s.two.id, position: 2, title: "Sorting", done: 0, total: 1, finished: false },
    ]);
    expect(courses[0].general).toEqual({ done: 0, total: 1, finished: false });
    expect(courses[1].course).toEqual({ done: 1, total: 1, finished: true });
    const page = await getCourseProgress(student, "TEST301");
    expect(courses[0]).toMatchObject({ course: { done: page.course.done, total: page.course.total, finished: page.course.finished }, exams: page.exams, general: page.general });
  });

  it("does not list a course whose only completion is of an unpublished file", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id);
    await s.lecture1.update({ isPublished: false });
    expect((await getProgressOverview(student)).courses).toEqual([]);
    await s.lecture1.update({ isPublished: true });
    expect((await getProgressOverview(student)).courses).toHaveLength(1);
  });

  it("reports General, finished chapters and the latest completion time", async () => {
    const { Completion } = getDb();
    const student = await user();
    const s = await seed();
    await markDone(student, s.notes.id);
    await markDone(student, s.general.id);
    await Completion.update({ createdAt: new Date("2026-01-01T10:00:00Z") }, { where: { resourceId: s.notes.id } });
    await Completion.update({ createdAt: new Date("2026-02-03T10:00:00Z") }, { where: { resourceId: s.general.id } });
    const [course] = (await getProgressOverview(student)).courses;
    expect(course.chapters[1]).toMatchObject({ position: 2, done: 1, total: 1, finished: true });
    expect(course.general).toEqual({ done: 1, total: 1, finished: true });
    expect(course.lastCompletedAt).toBe("2026-02-03T10:00:00.000Z");
  });

  it("never shows another student's completions", async () => {
    const mine = await user();
    const other = await user("other@example.com");
    const s = await seed();
    await markDone(other, s.lecture1.id);
    expect((await getProgressOverview(mine)).courses).toEqual([]);
    await markDone(mine, s.lecture2.id);
    const [course] = (await getProgressOverview(mine)).courses;
    expect(course.course.done).toBe(1);
  });
});

async function days(userId: string): Promise<string[]> {
  const rows = await getDb().StudyDay.findAll({ where: { userId }, order: [["day", "ASC"]], raw: true });
  return rows.map((row) => row.day);
}

describe("active days", () => {
  it("a new mark records today's Beirut day", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id, { now: new Date("2026-10-28T10:00:00Z") });
    expect(await days(student.id)).toEqual(["2026-10-28"]);
  });

  it("two marks the same day leave one row", async () => {
    const student = await user();
    const s = await seed();
    const now = new Date("2026-10-28T10:00:00Z");
    await markDone(student, s.lecture1.id, { now });
    await markDone(student, s.lecture2.id, { now: new Date("2026-10-28T15:00:00Z") });
    expect(await days(student.id)).toEqual(["2026-10-28"]);
  });

  it("marking an already done file adds nothing", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id, { now: new Date("2026-10-28T10:00:00Z") });
    const again = await markDone(student, s.lecture1.id, { now: new Date("2026-10-29T10:00:00Z") });
    expect(again.created).toBe(false);
    expect(await days(student.id)).toEqual(["2026-10-28"]);
  });

  it("a mark at 23:30 UTC counts for the next Beirut day", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id, { now: new Date("2026-12-10T23:30:00Z") });
    expect(await days(student.id)).toEqual(["2026-12-11"]);
  });

  it("un-marking keeps the day", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id, { now: new Date("2026-10-28T10:00:00Z") });
    await unmarkDone(student, s.lecture1.id);
    expect(await days(student.id)).toEqual(["2026-10-28"]);
  });

  it("deleting the user removes their days", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id);
    await getDb().User.destroy({ where: { id: student.id } });
    expect(await getDb().StudyDay.count()).toBe(0);
  });
});

describe("getProgressOverview week", () => {
  const add = (userId: string, day: string) => getDb().StudyDay.create({ userId, day });

  it("starts on Monday in Beirut time and lists only that week's days, ascending", async () => {
    const student = await user();
    for (const day of ["2026-10-25", "2026-11-01", "2026-10-28", "2026-10-26", "2026-11-02"]) await add(student.id, day);
    // Sunday 2026-11-01 23:30 Beirut (UTC+2): still the week of Monday 2026-10-26.
    const { week } = await getProgressOverview(student, { now: new Date("2026-11-01T21:30:00Z") });
    expect(week).toEqual({ start: "2026-10-26", today: "2026-11-01", activeDays: ["2026-10-26", "2026-10-28", "2026-11-01"] });
    // 30 minutes later it is Monday 2026-11-02 in Beirut: a new week.
    const next = await getProgressOverview(student, { now: new Date("2026-11-01T22:30:00Z") });
    expect(next.week).toEqual({ start: "2026-11-02", today: "2026-11-02", activeDays: ["2026-11-02"] });
  });

  it("never shows another user's days", async () => {
    const mine = await user();
    const other = await user("other@example.com");
    await add(other.id, "2026-10-28");
    const overview = await getProgressOverview(mine, { now: new Date("2026-10-28T10:00:00Z") });
    expect(overview.week.activeDays).toEqual([]);
    expect(overview.hasCompletions).toBe(false);
  });

  it("hasCompletions is true after a mark, also once it is un-marked", async () => {
    const student = await user();
    const s = await seed();
    expect((await getProgressOverview(student)).hasCompletions).toBe(false);
    await markDone(student, s.lecture1.id);
    await unmarkDone(student, s.lecture1.id);
    expect((await getProgressOverview(student)).hasCompletions).toBe(true);
  });
});

describe("milestones", () => {
  const earned = async (userId: string) =>
    (await getDb().Milestone.findAll({ where: { userId } })).map((m) => m.key).sort();
  const sorted = (keys: MilestoneKey[]) => [...keys].sort();

  // Completions made directly, as if marked earlier, so a threshold can be crossed by one mark.
  async function fill(userId: string, courseId: string, count: number, prefix: string) {
    const { Resource, Completion } = getDb();
    for (let i = 0; i < count; i++) {
      const r = await Resource.create({ courseId, type: "lecture", title: `${prefix}${i}`, fileKey: "k", isPublished: true });
      await Completion.create({ userId, resourceId: r.id });
    }
  }

  it("first_file comes with the first mark only", async () => {
    const student = await user();
    const s = await seed();
    expect((await markDone(student, s.lecture1.id)).rewards).toEqual({ milestones: ["first_file"] });
    expect((await markDone(student, s.lecture2.id)).rewards).toEqual({ milestones: [] });
  });

  it("files_10 at the tenth file, not the ninth", async () => {
    const student = await user();
    const s = await seed();
    await fill(student.id, s.course.id, 8, "A");
    const ninth = await markDone(student, s.lecture1.id);
    expect(ninth.rewards.milestones).toEqual(["first_file"]);
    const tenth = await markDone(student, s.lecture2.id);
    expect(tenth.rewards.milestones).toEqual(["files_10"]);
  });

  it("files_50 at the fiftieth file, not the forty-ninth", async () => {
    const student = await user();
    const s = await seed();
    await fill(student.id, s.course.id, 48, "B");
    expect((await markDone(student, s.lecture1.id)).rewards.milestones).toEqual(["first_file", "files_10"]);
    expect((await markDone(student, s.lecture2.id)).rewards.milestones).toEqual(["files_50"]);
  });

  it("an unpublished file does not count toward the file counts", async () => {
    const student = await user();
    const s = await seed();
    await fill(student.id, s.course.id, 8, "C");
    await getDb().Resource.update({ isPublished: false }, { where: { title: ["C0", "C1"] } });
    // 6 published + this one = 7 published completions.
    expect((await markDone(student, s.lecture1.id)).rewards.milestones).toEqual(["first_file"]);
    expect((await markDone(student, s.lecture2.id)).rewards.milestones).toEqual([]);
  });

  it("first_chapter when every counted file of a chapter is done", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id);
    await markDone(student, s.lecture2.id);
    expect((await markDone(student, s.exercise.id)).rewards.milestones).toEqual(["first_chapter"]);
  });

  it("first_chapter is not earned by a chapter with a file still to do", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id);
    expect(await earned(student.id)).toEqual(["first_file"]);
  });

  it("first_course when every counted file of the course is done, and not before", async () => {
    const student = await user();
    const s = await seed();
    for (const r of [s.lecture1, s.lecture2, s.exercise, s.notes]) await markDone(student, r.id);
    const last = await markDone(student, s.general.id);
    expect(last.rewards.milestones).toEqual(["first_course"]);
    expect(sorted(await getDb().Milestone.findAll({ where: { userId: student.id } }).then((rows) => rows.map((r) => r.key)))).toEqual(
      sorted(["first_file", "first_chapter", "first_course"]),
    );
  });

  it("all_exams_of_course needs every published exam done", async () => {
    const student = await user();
    const s = await seed();
    expect((await markDone(student, s.exam1.id)).rewards.milestones).toEqual(["first_file"]);
    expect((await markDone(student, s.exam2.id)).rewards.milestones).toEqual(["all_exams_of_course"]);
  });

  it("all_exams_of_course needs at least one published exam", async () => {
    const student = await user();
    const s = await seed();
    await getDb().Resource.update({ isPublished: false }, { where: { id: [s.exam1.id, s.exam2.id] } });
    await markDone(student, s.lecture1.id);
    expect(await earned(student.id)).toEqual(["first_file"]);
  });

  it("a repeated mark earns nothing", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id);
    expect((await markDone(student, s.lecture1.id)).rewards).toEqual({ milestones: [] });
  });

  it("un-marking keeps milestones, and re-marking earns them no second time", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id);
    const before = await getDb().Milestone.findOne({ where: { userId: student.id, key: "first_file" } });
    await unmarkDone(student, s.lecture1.id);
    expect(await earned(student.id)).toEqual(["first_file"]);
    expect((await markDone(student, s.lecture1.id)).rewards).toEqual({ milestones: [] });
    const after = await getDb().Milestone.findOne({ where: { userId: student.id, key: "first_file" } });
    expect(after?.earnedAt).toEqual(before?.earnedAt);
  });

  it("the overview lists all six in order, with earnedAt or null", async () => {
    const student = await user();
    const s = await seed();
    expect((await getProgressOverview(student)).milestones.map((m) => [m.key, m.earnedAt])).toEqual(MILESTONE_KEYS.map((key) => [key, null]));
    await markDone(student, s.lecture1.id);
    const { milestones } = await getProgressOverview(student);
    expect(milestones.map((m) => m.key)).toEqual([...MILESTONE_KEYS]);
    expect(milestones[0]).toEqual({ key: "first_file", label: "First file done", earnedAt: expect.stringMatching(/^\d{4}-/) });
    expect(milestones.slice(1).every((m) => m.earnedAt === null)).toBe(true);
    expect(milestones.map((m) => m.label)).toEqual([
      "First file done", "10 files done", "50 files done", "First chapter finished", "First course finished", "All past exams of a course",
    ]);
  });

  it("never shows another user's milestones", async () => {
    const mine = await user();
    const other = await user("other@example.com");
    const s = await seed();
    await markDone(other, s.lecture1.id);
    expect((await getProgressOverview(mine)).milestones.every((m) => m.earnedAt === null)).toBe(true);
  });

  it("the key check refuses an unknown key", async () => {
    const student = await user();
    await expect(
      getDb().sequelize.query(`INSERT INTO milestones (user_id, key) VALUES ($1, 'nope')`, { bind: [student.id] }),
    ).rejects.toThrow();
  });
});

describe("markDone rewards", () => {
  it("returns chapterFinished on the last counted file of a chapter, with the next chapter", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id);
    await markDone(student, s.lecture2.id);
    const { rewards } = await markDone(student, s.exercise.id);
    expect(rewards.chapterFinished).toEqual({ position: 1, title: "Basics", nextChapter: { position: 2, title: "Sorting" } });
    expect(rewards.courseFinished).toBeNull();
  });

  it("skips a next chapter with no counted published file, and has none at the end", async () => {
    const student = await user();
    const s = await seed();
    const { Chapter, Resource } = getDb();
    const empty = await Chapter.create({ courseId: s.course.id, position: 3, title: "Empty" });
    await Resource.create({ courseId: s.course.id, chapterId: empty.id, type: "lecture", title: "Hidden", fileKey: "k", isPublished: false });
    const skipTo = await Chapter.create({ courseId: s.course.id, position: 4, title: "Later" });
    await Resource.create({ courseId: s.course.id, chapterId: skipTo.id, type: "notes", title: "Later notes", fileKey: "k", isPublished: true });
    const { rewards } = await markDone(student, s.notes.id);
    expect(rewards.chapterFinished).toEqual({ position: 2, title: "Sorting", nextChapter: { position: 4, title: "Later" } });
    const last = await markDone(student, (await Resource.findOne({ where: { title: "Later notes" } }))!.id);
    expect(last.rewards.chapterFinished).toEqual({ position: 4, title: "Later", nextChapter: null });
  });

  it("returns courseFinished with the file total and the exams, and both when one mark finishes both", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.lecture1.id);
    await markDone(student, s.lecture2.id);
    await markDone(student, s.exercise.id);
    await markDone(student, s.general.id);
    await markDone(student, s.exam1.id);
    const { rewards } = await markDone(student, s.notes.id);
    expect(rewards.courseFinished).toEqual({ code: "TEST301", title: "Course A", filesTotal: 5, exams: { done: 1, total: 2 } });
    expect(rewards.chapterFinished).toEqual({ position: 2, title: "Sorting", nextChapter: null });
  });

  it("returns nothing on a repeated mark or for an exam", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.notes.id);
    const again = await markDone(student, s.notes.id);
    expect(again.rewards).toEqual({ milestones: [], chapterFinished: null, courseFinished: null });
    const exam = await markDone(student, s.exam1.id);
    expect(exam.rewards.chapterFinished).toBeNull();
    expect(exam.rewards.courseFinished).toBeNull();
  });

  it("returns it again after an un-mark and re-mark", async () => {
    const student = await user();
    const s = await seed();
    expect((await markDone(student, s.notes.id)).rewards.chapterFinished).not.toBeNull();
    await unmarkDone(student, s.notes.id);
    expect((await markDone(student, s.notes.id)).rewards.chapterFinished).not.toBeNull();
  });

  it("returns it again after new material is published and completed", async () => {
    const student = await user();
    const s = await seed();
    await markDone(student, s.notes.id);
    const extra = await getDb().Resource.create({ courseId: s.course.id, chapterId: s.two.id, type: "exercise", title: "New", fileKey: "k", isPublished: true });
    const { rewards } = await markDone(student, extra.id);
    expect(rewards.chapterFinished).toMatchObject({ position: 2 });
  });
});

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import type { Viewer } from "../viewer";
import { getHomeStats } from "./home";

const SAMPLE_URL = "https://example.com/sample";
const SAMPLE_KEY = "resources/sample.pdf";
const admin: Viewer = { id: "11111111-1111-4111-8111-111111111111", role: "admin" };

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeDb();
});

async function seed() {
  const { Course, Chapter, Resource } = getDb();
  const a = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
  await Course.create({ code: "TEST302", title: "Course B (empty)", semester: 3 });
  const c = await Course.create({ code: "TEST501", title: "Course C", semester: 5 });
  await Chapter.create({ courseId: a.id, position: 1, title: "Chapter 1" });
  await Chapter.create({ courseId: a.id, position: 2, title: "Chapter 2" });
  await Chapter.create({ courseId: c.id, position: 1, title: "Chapter 1" });
  await Resource.create({ courseId: a.id, type: "lecture", title: "Published lecture", isPublished: true, fileKey: SAMPLE_KEY, externalUrl: SAMPLE_URL });
  await Resource.create({ courseId: a.id, type: "exam", title: "Published exam", academicYearStart: 2024, examSession: "final", isPublished: true, fileKey: SAMPLE_KEY, externalUrl: SAMPLE_URL });
  await Resource.create({ courseId: a.id, type: "notes", title: "Draft notes" });
  await Resource.create({ courseId: c.id, type: "exam", title: "Draft exam", academicYearStart: 2024, examSession: "partial" });
  await Resource.create({ courseId: c.id, type: "lecture", title: "Published lecture C", isPublished: true, fileKey: SAMPLE_KEY, externalUrl: SAMPLE_URL });
}

describe("getHomeStats", () => {
  it("gives zeros and one ordered entry per year for an empty database", async () => {
    expect(await getHomeStats(null)).toEqual({
      totals: { courses: 0, chapters: 0, resources: 0, exams: 0 },
      years: [1, 2, 3, 4].map((year) => ({ year, courseCount: 0, resourceCount: 0, courseCodes: [], courses: [] })),
    });
  });

  it("does not count drafts for an anonymous viewer, and counts exams in resources and exams", async () => {
    await seed();
    const stats = await getHomeStats(null);
    expect(stats.totals).toEqual({ courses: 3, chapters: 3, resources: 3, exams: 1 });
  });

  it("counts drafts for an admin", async () => {
    await seed();
    const stats = await getHomeStats(admin);
    expect(stats.totals).toEqual({ courses: 3, chapters: 3, resources: 5, exams: 2 });
  });

  it("counts a course with no resources", async () => {
    const { Course } = getDb();
    await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
    const stats = await getHomeStats(null);
    expect(stats.totals.courses).toBe(1);
    expect(stats.totals.resources).toBe(0);
  });

  it("puts per-year counts and codes in the right year, in order", async () => {
    await seed();
    expect((await getHomeStats(null)).years).toEqual([
      { year: 1, courseCount: 0, resourceCount: 0, courseCodes: [], courses: [] },
      {
        year: 2,
        courseCount: 2,
        resourceCount: 2,
        courseCodes: ["TEST301", "TEST302"],
        courses: [
          { code: "TEST301", title: "Course A", semester: 3, fileCount: 2 },
          { code: "TEST302", title: "Course B (empty)", semester: 3, fileCount: 0 },
        ],
      },
      {
        year: 3,
        courseCount: 1,
        resourceCount: 1,
        courseCodes: ["TEST501"],
        courses: [{ code: "TEST501", title: "Course C", semester: 5, fileCount: 1 }],
      },
      { year: 4, courseCount: 0, resourceCount: 0, courseCodes: [], courses: [] },
    ]);
    expect((await getHomeStats(admin)).years.map((y) => y.resourceCount)).toEqual([0, 3, 2, 0]);
  });

  it("orders codes by semester, then code, and keeps a year with only courses without files", async () => {
    const { Course } = getDb();
    await Course.create({ code: "TEST100", title: "S2 course", semester: 2 });
    await Course.create({ code: "TEST900", title: "S1 course", semester: 1 });
    await Course.create({ code: "TEST200", title: "S1 course b", semester: 1 });
    const [first] = (await getHomeStats(null)).years;
    expect(first.courseCodes).toEqual(["TEST200", "TEST900", "TEST100"]);
    expect(first.resourceCount).toBe(0);
    expect(first.courses.map((c) => [c.code, c.semester, c.fileCount])).toEqual([
      ["TEST200", 1, 0],
      ["TEST900", 1, 0],
      ["TEST100", 2, 0],
    ]);
  });

  it("counts only visible files per course: drafts for an admin only", async () => {
    await seed();
    const fileCounts = (stats: Awaited<ReturnType<typeof getHomeStats>>) =>
      Object.fromEntries(stats.years.flatMap((y) => y.courses).map((c) => [c.code, c.fileCount]));
    expect(fileCounts(await getHomeStats(null))).toEqual({ TEST301: 2, TEST302: 0, TEST501: 1 });
    expect(fileCounts(await getHomeStats(admin))).toEqual({ TEST301: 3, TEST302: 0, TEST501: 2 });
  });
});

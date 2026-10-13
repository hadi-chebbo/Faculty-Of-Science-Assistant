import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import type { Viewer } from "../viewer";
import { getHomeStats } from "./home";

const SAMPLE_URL = "https://example.com/sample";
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
  await Resource.create({ courseId: a.id, type: "lecture", title: "Published lecture", isPublished: true, externalUrl: SAMPLE_URL });
  await Resource.create({ courseId: a.id, type: "exam", title: "Published exam", academicYearStart: 2024, examSession: "final", isPublished: true, externalUrl: SAMPLE_URL });
  await Resource.create({ courseId: a.id, type: "notes", title: "Draft notes" });
  await Resource.create({ courseId: c.id, type: "exam", title: "Draft exam", academicYearStart: 2024, examSession: "partial" });
  await Resource.create({ courseId: c.id, type: "lecture", title: "Published lecture C", isPublished: true, externalUrl: SAMPLE_URL });
}

describe("getHomeStats", () => {
  it("gives zeros and four ordered semesters for an empty database", async () => {
    expect(await getHomeStats(null)).toEqual({
      totals: { courses: 0, chapters: 0, resources: 0, exams: 0 },
      semesters: [3, 4, 5, 6].map((semester) => ({ semester, courseCount: 0, resourceCount: 0 })),
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

  it("puts per-semester counts in the right semester, in order", async () => {
    await seed();
    expect((await getHomeStats(null)).semesters).toEqual([
      { semester: 3, courseCount: 2, resourceCount: 2 },
      { semester: 4, courseCount: 0, resourceCount: 0 },
      { semester: 5, courseCount: 1, resourceCount: 1 },
      { semester: 6, courseCount: 0, resourceCount: 0 },
    ]);
    expect((await getHomeStats(admin)).semesters.map((s) => s.resourceCount)).toEqual([3, 0, 2, 0]);
  });
});

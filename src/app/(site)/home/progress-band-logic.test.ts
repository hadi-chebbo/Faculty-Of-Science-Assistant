import { describe, expect, it } from "vitest";
import { activeDaysText, courseLabel, topCourses, type BandCourse } from "./progress-band-logic";

const course = (code: string, last: string, done = 1, total = 4, finished = false): BandCourse => ({
  code,
  title: "Sample Course",
  semester: 3,
  lastCompletedAt: last,
  course: { done, total, finished },
  exams: { done: 0, total: 2 },
  chapters: [],
  general: { done: 0, total: 0, finished: false },
});

describe("progress band", () => {
  it("keeps the three most recent courses, newest first", () => {
    const list = [course("A", "2026-01-01"), course("B", "2026-03-01"), course("C", "2026-02-01"), course("D", "2026-04-01")];
    expect(topCourses(list).map((c) => c.code)).toEqual(["D", "B", "C"]);
  });
  it("words the active days", () => {
    expect(activeDaysText(0)).toBe("No active days yet this week");
    expect(activeDaysText(1)).toBe("1 active day this week");
    expect(activeDaysText(4)).toBe("4 active days this week");
  });
  it("labels rows", () => {
    expect(courseLabel(course("X", "t"))).toBe("X Sample Course, 25% done, 1 of 4 files");
    expect(courseLabel(course("X", "t", 4, 4, true))).toBe("X Sample Course, finished, 4 of 4 files");
    expect(courseLabel(course("X", "t", 0, 0))).toBe("X Sample Course, exams: 0 of 2 done");
  });
});

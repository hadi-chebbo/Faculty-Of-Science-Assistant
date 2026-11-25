import { describe, expect, it } from "vitest";
import { activeDaysText, continueMeta, courseLabel, resumeHref, resumeLabel, topCourses, type BandCourse } from "./progress-band-logic";

describe("the continue part", () => {
  const entry = { id: "3f2b8a4e-1c5d-4e6f-8a9b-0c1d2e3f4a5b", title: "Sample lecture", courseCode: "DEMO301", type: "lecture" as const, at: "x" };

  it("links to the reader, with the page only after the first", () => {
    expect(resumeHref(entry.id, 7)).toBe(`/resources/${entry.id}#page=7`);
    expect(resumeHref(entry.id, 1)).toBe(`/resources/${entry.id}`);
    expect(resumeHref(entry.id, null)).toBe(`/resources/${entry.id}`);
  });

  it("names the course, the type and the page after the first", () => {
    expect(continueMeta(entry, 7)).toBe("DEMO301 · Lecture · Page 7");
    expect(continueMeta(entry, 1)).toBe("DEMO301 · Lecture");
    expect(continueMeta(entry, null)).toBe("DEMO301 · Lecture");
  });

  it("gives the Resume link an accessible name", () => {
    expect(resumeLabel(entry.title, 7)).toBe("Resume Sample lecture, page 7");
    expect(resumeLabel(entry.title, null)).toBe("Resume Sample lecture");
  });
});

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

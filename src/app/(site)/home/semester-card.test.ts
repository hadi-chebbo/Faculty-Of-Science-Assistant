import { describe, expect, it } from "vitest";
import { semesterCardText, showStats } from "./semester-card";

describe("semesterCardText", () => {
  it("shows counts for a semester with courses", () => {
    expect(semesterCardText({ semester: 3, courseCount: 3, resourceCount: 58 })).toEqual({
      tag: "Autumn",
      label: "S3",
      name: "Semester 3",
      counts: "3 courses · 58 files",
      empty: null,
    });
  });

  it("uses the singular for one course and one file", () => {
    expect(semesterCardText({ semester: 5, courseCount: 1, resourceCount: 1 }).counts).toBe("1 course · 1 file");
  });

  it("says 0 files for a course without files", () => {
    expect(semesterCardText({ semester: 6, courseCount: 2, resourceCount: 0 }).counts).toBe("2 courses · 0 files");
  });

  it("tags even semesters as spring and says material arrives in spring when empty", () => {
    expect(semesterCardText({ semester: 4, courseCount: 0, resourceCount: 0 })).toEqual({
      tag: "Spring",
      label: "S4",
      name: "Semester 4",
      counts: null,
      empty: "Material arrives in spring",
    });
  });

  it("says no material yet for an empty autumn semester", () => {
    const text = semesterCardText({ semester: 5, courseCount: 0, resourceCount: 0 });
    expect(text.tag).toBe("Autumn");
    expect(text.counts).toBeNull();
    expect(text.empty).toBe("No material yet");
  });
});

describe("showStats", () => {
  it("needs at least 5 courses", () => {
    expect(showStats(4)).toBe(false);
    expect(showStats(5)).toBe(true);
    expect(showStats(0)).toBe(false);
  });
});

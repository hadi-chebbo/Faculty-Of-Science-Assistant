import { describe, expect, it } from "vitest";
import {
  YEARS,
  courseYearSemesterLabel,
  groupSemestersByYear,
  storedSemester,
  parseYear,
  semesterAnchor,
  semesterInYear,
  semesterLabel,
  semestersOfYear,
  yearCrumb,
  yearHref,
  yearBadge,
  yearLabel,
  yearOfSemester,
  yearSlug,
} from "./years";

describe("semester anchors and year crumbs", () => {
  it("anchors a semester by its place in the year", () => {
    expect([1, 2, 3, 4, 5, 6].map(semesterAnchor)).toEqual([
      "semester-1", "semester-2", "semester-1", "semester-2", "semester-1", "semester-2",
    ]);
  });

  it("builds the year crumb for a course's semester", () => {
    expect(yearCrumb(3)).toEqual({ label: "Second year", href: "/years/2#semester-1" });
    expect(yearCrumb(6)).toEqual({ label: "Third year", href: "/years/3#semester-2" });
    expect(yearCrumb(8)).toEqual({ label: "Master 1", href: "/years/m1#semester-2" });
  });
});

describe("years", () => {
  it("lists the four years", () => {
    expect(YEARS).toEqual([1, 2, 3, 4]);
  });

  it("treats semesters 7 and 8 as Master 1", () => {
    expect(yearOfSemester(7)).toBe(4);
    expect(yearOfSemester(8)).toBe(4);
    expect(semestersOfYear(4)).toEqual([7, 8]);
    expect(yearLabel(4)).toBe("Master 1");
    expect(yearSlug(4)).toBe("m1");
    expect(YEARS.map(yearBadge)).toEqual(["1", "2", "3", "M1"]);
    expect([7, 8].map(semesterLabel)).toEqual(["Semester 1", "Semester 2"]);
  });

  it("maps a semester to its year", () => {
    expect([1, 2, 3, 4, 5, 6].map(yearOfSemester)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it("gives the two semesters of a year", () => {
    expect(semestersOfYear(1)).toEqual([1, 2]);
    expect(semestersOfYear(2)).toEqual([3, 4]);
    expect(semestersOfYear(3)).toEqual([5, 6]);
  });

  it("words each year", () => {
    expect(YEARS.map(yearLabel)).toEqual(["First year", "Second year", "Third year", "Master 1"]);
  });

  it("parses a valid year only", () => {
    expect(parseYear("1")).toBe(1);
    expect(parseYear("3")).toBe(3);
    expect(parseYear(2)).toBe(2);
    expect(parseYear("m1")).toBe(4);
    expect(parseYear(4)).toBe(4);
    for (const bad of ["0", "4", "5", "M1", "m2", "01", "1.5", "abc", "", " 1", null, undefined, 0, 5, 1.5]) {
      expect(parseYear(bad)).toBeNull();
    }
  });

  it("numbers a semester within its year", () => {
    expect([1, 2, 3, 4, 5, 6].map(semesterInYear)).toEqual([1, 2, 1, 2, 1, 2]);
    expect([1, 2, 3, 4, 5, 6].map(semesterLabel)).toEqual([
      "Semester 1",
      "Semester 2",
      "Semester 1",
      "Semester 2",
      "Semester 1",
      "Semester 2",
    ]);
  });

  it("builds year links", () => {
    expect(YEARS.map(yearSlug)).toEqual(["1", "2", "3", "m1"]);
    expect(yearHref(2)).toBe("/years/2");
    expect(yearHref(2, 3)).toBe("/years/2#semester-1");
    expect(yearHref(2, 4)).toBe("/years/2#semester-2");
    expect(yearHref(3, 6)).toBe("/years/3#semester-2");
    expect(yearHref(4, 7)).toBe("/years/m1#semester-1");
    expect(yearHref(4)).toBe("/years/m1");
  });
});

describe("year labels elsewhere", () => {
  it("combines year and semester", () => {
    expect([1, 2, 3, 4, 5, 6].map(courseYearSemesterLabel)).toEqual([
      "First year · Semester 1", "First year · Semester 2",
      "Second year · Semester 1", "Second year · Semester 2",
      "Third year · Semester 1", "Third year · Semester 2",
    ]);
  });

  it("labels Master 1 semesters", () => {
    expect(courseYearSemesterLabel(7)).toBe("Master 1 · Semester 1");
    expect(courseYearSemesterLabel(8)).toBe("Master 1 · Semester 2");
  });

  it("maps a year and a place in it to the stored number", () => {
    expect([storedSemester(1, 1), storedSemester(2, 2), storedSemester(3, 1)]).toEqual([1, 4, 5]);
    expect(storedSemester(4, 1)).toBe(7);
    expect(storedSemester(4, 2)).toBe(8);
  });

  it("groups semesters by year, skipping empty years and duplicates", () => {
    expect(groupSemestersByYear([5, 3, 3, 1])).toEqual([
      { year: 1, semesters: [1] },
      { year: 2, semesters: [3] },
      { year: 3, semesters: [5] },
    ]);
    expect(groupSemestersByYear([7, 1])).toEqual([
      { year: 1, semesters: [1] },
      { year: 4, semesters: [7] },
    ]);
    expect(groupSemestersByYear([4, 3])).toEqual([{ year: 2, semesters: [3, 4] }]);
    expect(groupSemestersByYear([])).toEqual([]);
  });
});

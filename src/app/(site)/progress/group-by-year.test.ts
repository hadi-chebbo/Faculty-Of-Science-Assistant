import { describe, expect, it } from "vitest";
import { groupCoursesByYear } from "./group-by-year";

describe("groupCoursesByYear", () => {
  it("groups by year, then semester, then code, and skips empty years", () => {
    const courses = [
      { code: "B5", semester: 5 },
      { code: "Z3", semester: 3 },
      { code: "A4", semester: 4 },
      { code: "A3", semester: 3 },
    ];
    expect(groupCoursesByYear(courses)).toEqual([
      { year: 2, courses: [{ code: "A3", semester: 3 }, { code: "Z3", semester: 3 }, { code: "A4", semester: 4 }] },
      { year: 3, courses: [{ code: "B5", semester: 5 }] },
    ]);
  });

  it("returns nothing for no courses", () => {
    expect(groupCoursesByYear([])).toEqual([]);
  });
});

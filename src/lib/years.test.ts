import { describe, expect, it } from "vitest";
import { YEARS, parseYear, semestersOfYear, yearLabel, yearOfSemester } from "./years";

describe("years", () => {
  it("lists the three years", () => {
    expect(YEARS).toEqual([1, 2, 3]);
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
    expect(YEARS.map(yearLabel)).toEqual(["First year", "Second year", "Third year"]);
  });

  it("parses a valid year only", () => {
    expect(parseYear("1")).toBe(1);
    expect(parseYear("3")).toBe(3);
    expect(parseYear(2)).toBe(2);
    for (const bad of ["0", "4", "01", "1.5", "abc", "", " 1", null, undefined, 0, 4, 1.5]) {
      expect(parseYear(bad)).toBeNull();
    }
  });
});

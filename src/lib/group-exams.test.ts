import { describe, expect, it } from "vitest";
import { groupExamsByYear } from "./group-exams";

const exam = (id: string, academicYearStart: number | null) => ({ id, academicYearStart });

describe("groupExamsByYear", () => {
  it("returns no groups for no exams", () => {
    expect(groupExamsByYear([])).toEqual([]);
  });

  it("groups by year, newest first, keeping the order inside a year", () => {
    const groups = groupExamsByYear([exam("a", 2024), exam("b", 2024), exam("c", 2023), exam("d", 2024)]);
    expect(groups.map((g) => [g.year, g.exams.map((e) => e.id)])).toEqual([
      [2024, ["a", "b", "d"]],
      [2023, ["c"]],
    ]);
  });

  it("puts exams with no year in a last block", () => {
    const groups = groupExamsByYear([exam("a", null), exam("b", 2023), exam("c", null), exam("d", 2022)]);
    expect(groups.map((g) => [g.year, g.exams.map((e) => e.id)])).toEqual([
      [2023, ["b"]],
      [2022, ["d"]],
      [null, ["a", "c"]],
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { statTiles } from "./stats-row";

const totals = { courses: 42, chapters: 300, resources: 1204, exams: 156, examYears: { first: 2015, last: 2024 } };

describe("statTiles", () => {
  it("gives files, courses, previous exams and the exam years, in that order", () => {
    expect(statTiles(totals)).toEqual([
      { key: "files", value: "1,204", label: "files" },
      { key: "courses", value: "42", label: "courses" },
      { key: "exams", value: "156", label: "previous exams" },
      { key: "examYears", value: "2015–2025", label: "exam years covered" },
    ]);
  });

  it("is empty when there is no published file", () => {
    expect(statTiles({ ...totals, resources: 0, exams: 0, examYears: null })).toEqual([]);
  });

  it("leaves both exam tiles out without an exam", () => {
    expect(statTiles({ ...totals, exams: 0, examYears: null }).map((t) => t.key)).toEqual(["files", "courses"]);
  });

  it("leaves the span out when no exam has a year", () => {
    expect(statTiles({ ...totals, examYears: null }).map((t) => t.key)).toEqual(["files", "courses", "exams"]);
  });

  it("agrees with one of each", () => {
    expect(statTiles({ courses: 1, chapters: 0, resources: 1, exams: 1, examYears: { first: 2024, last: 2024 } })).toEqual([
      { key: "files", value: "1", label: "file" },
      { key: "courses", value: "1", label: "course" },
      { key: "exams", value: "1", label: "previous exam" },
      { key: "examYears", value: "2024–2025", label: "exam year covered" },
    ]);
  });
});

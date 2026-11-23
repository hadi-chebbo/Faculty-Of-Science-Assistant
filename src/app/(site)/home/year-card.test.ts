import { describe, expect, it } from "vitest";
import { showStats, yearCardText } from "./year-card";

const codes = (n: number) => Array.from({ length: n }, (_, i) => `C${i + 1}`);

describe("yearCardText", () => {
  it("words a year with courses", () => {
    expect(
      yearCardText({ year: 2, courseCount: 3, resourceCount: 58, courseCodes: ["A1", "A2", "A3"] }),
    ).toEqual({
      circle: "2",
      label: "Second year",
      codes: ["A1", "A2", "A3"],
      more: null,
      counts: "3 courses · 58 files",
      empty: null,
    });
  });

  it("shows four codes and the rest as +N more", () => {
    const text = yearCardText({ year: 1, courseCount: 7, resourceCount: 101, courseCodes: codes(7) });
    expect(text.codes).toEqual(["C1", "C2", "C3", "C4"]);
    expect(text.more).toBe("+3 more");
    expect(text.counts).toBe("7 courses · 101 files");
  });

  it("has no +N more at exactly four codes", () => {
    expect(yearCardText({ year: 1, courseCount: 4, resourceCount: 1, courseCodes: codes(4) }).more).toBeNull();
  });

  it("uses the singular for one course and one file", () => {
    expect(yearCardText({ year: 3, courseCount: 1, resourceCount: 1, courseCodes: ["X"] }).counts).toBe(
      "1 course · 1 file",
    );
  });

  it("says 0 files for courses without files", () => {
    expect(yearCardText({ year: 3, courseCount: 2, resourceCount: 0, courseCodes: ["X", "Y"] }).counts).toBe(
      "2 courses · 0 files",
    );
  });

  it("marks a year with no course as empty", () => {
    expect(yearCardText({ year: 3, courseCount: 0, resourceCount: 0, courseCodes: [] })).toEqual({
      circle: "3",
      label: "Third year",
      codes: [],
      more: null,
      counts: null,
      empty: "No courses yet",
    });
  });
});

describe("yearCardText for Master 1", () => {
  it("uses the M1 badge and the Master 1 label", () => {
    expect(yearCardText({ year: 4, courseCount: 0, resourceCount: 0, courseCodes: [] })).toMatchObject({
      circle: "M1",
      label: "Master 1",
      counts: null,
      empty: "No courses yet",
    });
  });
});

describe("showStats", () => {
  it("needs at least 5 courses", () => {
    expect(showStats(4)).toBe(false);
    expect(showStats(5)).toBe(true);
    expect(showStats(0)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { EXAMS_PAGE_SIZE, examsHref, hasActiveFilters, pagerLinks, parseExamParams, reconcileCourse, totalPages } from "./params";

describe("parseExamParams", () => {
  it("reads valid values", () => {
    expect(parseExamParams({ semester: "3", course: "DEMO301", year: "2024", session: "final", page: "2" })).toEqual({
      semester: 3,
      course: "DEMO301",
      year: 2024,
      session: "final",
      page: 2,
    });
  });

  it("gives the first page and no filters for an empty query", () => {
    expect(parseExamParams({})).toEqual({
      semester: undefined,
      course: undefined,
      year: undefined,
      session: undefined,
      page: 1,
    });
  });

  it("drops each bad value on its own and keeps the good ones", () => {
    const parsed = parseExamParams({ year: "abc", session: "bogus", semester: "9", page: "0", course: "DEMO301" });
    expect(parsed).toEqual({ semester: undefined, course: "DEMO301", year: undefined, session: undefined, page: 1 });
    expect(parseExamParams({ semester: "2", year: "1989", page: "-1" })).toMatchObject({ page: 1, semester: undefined, year: undefined });
    expect(parseExamParams({ year: "2024.5", semester: "4e0", page: "1.5" })).toMatchObject({ year: undefined, semester: undefined, page: 1 });
    expect(parseExamParams({ page: "10001" }).page).toBe(1);
    expect(parseExamParams({ course: "x".repeat(21) }).course).toBeUndefined();
  });

  it("treats blank values as absent", () => {
    expect(parseExamParams({ semester: "", course: "  ", year: "", session: "", page: "" })).toEqual(parseExamParams({}));
  });

  it("takes the first of a repeated parameter", () => {
    expect(parseExamParams({ year: ["2023", "2024"], session: ["final", "partial"], page: ["3", "4"] })).toMatchObject({
      year: 2023,
      session: "final",
      page: 3,
    });
    expect(parseExamParams({ year: ["abc", "2024"] }).year).toBeUndefined();
    expect(parseExamParams({ year: [] }).year).toBeUndefined();
  });
});

describe("reconcileCourse", () => {
  const courses = [
    { code: "DEMO301", semester: 3 },
    { code: "DEMO401", semester: 4 },
  ];

  it("drops a course that is not in the selected semester", () => {
    const params = parseExamParams({ semester: "4", course: "DEMO301" });
    expect(reconcileCourse(params, courses).course).toBeUndefined();
    expect(reconcileCourse(params, courses).semester).toBe(4);
  });

  it("keeps a matching course and writes it with its real letter case", () => {
    expect(reconcileCourse(parseExamParams({ semester: "3", course: "demo301" }), courses).course).toBe("DEMO301");
    expect(reconcileCourse(parseExamParams({ course: "demo401" }), courses).course).toBe("DEMO401");
  });

  it("keeps an unknown course code, which then matches nothing", () => {
    expect(reconcileCourse(parseExamParams({ semester: "3", course: "NOPE1" }), courses).course).toBe("NOPE1");
  });

  it("leaves params without a course alone", () => {
    const params = parseExamParams({ semester: "3" });
    expect(reconcileCourse(params, courses)).toBe(params);
  });
});

describe("examsHref", () => {
  it("is the plain address without filters, and leaves out page 1", () => {
    expect(examsHref({ page: 1 })).toBe("/exams");
    expect(examsHref({ semester: 3, page: 1 })).toBe("/exams?semester=3");
  });

  it("keeps every filter and adds the page after the first", () => {
    expect(examsHref({ semester: 3, course: "DEMO301", year: 2024, session: "final", page: 2 })).toBe(
      "/exams?semester=3&course=DEMO301&year=2024&session=final&page=2",
    );
    expect(examsHref({ session: "second", page: 3 })).toBe("/exams?session=second&page=3");
  });

  it("round-trips through parseExamParams", () => {
    const params = { semester: 5, course: "DEMO501", year: 2025, session: "final" as const, page: 4 };
    const query = Object.fromEntries(new URL(examsHref(params), "http://x").searchParams);
    expect(parseExamParams(query)).toEqual(params);
  });

  it("changing a filter by link building starts again at page 1", () => {
    const current = parseExamParams({ session: "final", page: "3" });
    expect(examsHref({ ...current, page: current.page + 1 })).toBe("/exams?session=final&page=4");
    expect(examsHref({ ...current, year: 2024, page: 1 })).toBe("/exams?year=2024&session=final");
  });
});

describe("totalPages", () => {
  it("rounds up and is at least 1", () => {
    expect(totalPages(0, EXAMS_PAGE_SIZE)).toBe(1);
    expect(totalPages(1, EXAMS_PAGE_SIZE)).toBe(1);
    expect(totalPages(20, EXAMS_PAGE_SIZE)).toBe(1);
    expect(totalPages(21, EXAMS_PAGE_SIZE)).toBe(2);
    expect(totalPages(41, EXAMS_PAGE_SIZE)).toBe(3);
  });
});

describe("hasActiveFilters", () => {
  it("ignores the page", () => {
    expect(hasActiveFilters(parseExamParams({ page: "2" }))).toBe(false);
    expect(hasActiveFilters(parseExamParams({ year: "2024" }))).toBe(true);
  });
});

describe("pagerLinks", () => {
  const filters = parseExamParams({ semester: "3", session: "final" });

  it("has no links for a single page", () => {
    expect(pagerLinks(filters, 9, EXAMS_PAGE_SIZE)).toEqual({ pages: 1, previous: null, next: null });
    expect(pagerLinks(filters, 20, EXAMS_PAGE_SIZE)).toEqual({ pages: 1, previous: null, next: null });
  });

  it("links to the next page from the first, keeping the filters", () => {
    expect(pagerLinks(filters, 21, EXAMS_PAGE_SIZE)).toEqual({
      pages: 2,
      previous: null,
      next: "/exams?semester=3&session=final&page=2",
    });
  });

  it("links both ways in the middle, and back to the plain first page", () => {
    const middle = { ...filters, page: 2 };
    expect(pagerLinks(middle, 45, EXAMS_PAGE_SIZE)).toEqual({
      pages: 3,
      previous: "/exams?semester=3&session=final",
      next: "/exams?semester=3&session=final&page=3",
    });
  });

  it("has only a previous link on the last page", () => {
    expect(pagerLinks({ ...filters, page: 3 }, 45, EXAMS_PAGE_SIZE)).toEqual({
      pages: 3,
      previous: "/exams?semester=3&session=final&page=2",
      next: null,
    });
  });
});

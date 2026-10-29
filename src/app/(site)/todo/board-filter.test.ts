import { describe, expect, it } from "vitest";
import { ALL_COURSES, courseCodes, effectiveChip, matchesFilter, NOTES_ONLY, realIndexFor } from "./board-filter";

const file = (courseCode: string) => ({ available: true as const, id: "r", title: "T", type: "lecture" as const, courseCode, done: false });
const note = (text = "") => ({ note: text, resource: null });
const linked = (code: string, text = "") => ({ note: text, resource: file(code) });
const codes = ["DEMO301", "DEMO502"];

describe("matchesFilter", () => {
  it("shows everything with no filter", () => {
    expect(matchesFilter(note(), "Anything", { text: "", chip: ALL_COURSES }, codes)).toBe(true);
  });
  it("matches title, note and course code, ignoring case and accents", () => {
    const f = (text: string) => ({ text, chip: ALL_COURSES });
    expect(matchesFilter(note(), "Révise l'été", f("ETE"), codes)).toBe(true);
    expect(matchesFilter(note("Ask about GRAPHS"), "x", f("graphs"), codes)).toBe(true);
    expect(matchesFilter(linked("DEMO301"), "x", f("demo301"), codes)).toBe(true);
    expect(matchesFilter(note(), "x", f("zzz"), codes)).toBe(false);
  });
  it("needs both the chip and the text", () => {
    expect(matchesFilter(linked("DEMO301"), "Sorting", { text: "sort", chip: "DEMO301" }, codes)).toBe(true);
    expect(matchesFilter(linked("DEMO301"), "Sorting", { text: "sort", chip: "DEMO502" }, codes)).toBe(false);
    expect(matchesFilter(linked("DEMO301"), "Sorting", { text: "graph", chip: "DEMO301" }, codes)).toBe(false);
  });
  it("Notes only keeps the cards with no file", () => {
    expect(matchesFilter(note(), "x", { text: "", chip: NOTES_ONLY }, codes)).toBe(true);
    expect(matchesFilter(linked("DEMO301"), "x", { text: "", chip: NOTES_ONLY }, codes)).toBe(false);
    expect(matchesFilter({ note: "", resource: { available: false } }, "x", { text: "", chip: NOTES_ONLY }, codes)).toBe(false);
  });
  it("treats a chip for a course with no cards as All", () => {
    expect(matchesFilter(note(), "x", { text: "", chip: "GONE" }, codes)).toBe(true);
    expect(effectiveChip("GONE", codes)).toBe(ALL_COURSES);
  });
});

describe("courseCodes", () => {
  it("lists each course once, sorted, from available files only", () => {
    expect(courseCodes([linked("B"), linked("A"), linked("B"), note(), { resource: { available: false } }])).toEqual(["A", "B"]);
  });
});

describe("realIndexFor", () => {
  // Real column [A, x, B, y, C] with x and y hidden.
  it("moves a card down past its visible neighbour only", () => {
    // A moves down: real without A = [x, B, y, C]; visible without A = [B, C]; new visible place 1.
    expect(realIndexFor(["x", "B", "y", "C"], ["B", "C"], 1, true)).toBe(2);
  });
  it("moves a card up past its visible neighbour only", () => {
    // C moves up: real without C = [A, x, B, y]; visible = [A, B]; new visible place 1.
    expect(realIndexFor(["A", "x", "B", "y"], ["A", "B"], 1, false)).toBe(2);
  });
  it("drops at the top and the end of the visible cards", () => {
    expect(realIndexFor(["x", "B", "y", "C"], ["B", "C"], 0, false)).toBe(1);
    expect(realIndexFor(["x", "B", "y", "C"], ["B", "C"], 2, false)).toBe(4);
  });
  it("is the plain index when nothing is hidden", () => {
    expect(realIndexFor(["a", "b"], ["a", "b"], 2, true)).toBe(2);
    expect(realIndexFor(["a", "b"], ["a", "b"], 1, false)).toBe(1);
  });
  it("handles an empty visible column", () => {
    expect(realIndexFor(["x"], [], 0, false)).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { buildResult, countLabel, findMatches, firstMatchFrom, stepMatch } from "./reader-search";
import { foldQuery } from "@/lib/text-fold";

const items = (...strs: string[]) => strs.map((str) => ({ str }));

describe("foldQuery", () => {
  it("ignores case, accents and runs of white space, and trims", () => {
    expect(foldQuery("  École   Été ")).toBe("ecole ete");
    expect(foldQuery("été")).toBe("ete");
    expect(foldQuery("   ")).toBe("");
  });
});

describe("findMatches", () => {
  it("finds a word whatever its case", () => {
    expect(findMatches(items("Relations and RELATION"), "relation")).toEqual([
      [{ item: 0, start: 0, end: 8 }],
      [{ item: 0, start: 14, end: 22 }],
    ]);
  });

  it("finds an accented word from the plain letters, and the other way round", () => {
    expect(findMatches(items("été"), "ete")).toEqual([[{ item: 0, start: 0, end: 3 }]]);
    expect(findMatches(items("ete"), "été")).toEqual([[{ item: 0, start: 0, end: 3 }]]);
    expect(findMatches(items("Ça va, à très bientôt"), "tres")).toEqual([[{ item: 0, start: 9, end: 13 }]]);
  });

  it("reports positions in the original text, also when it is stored decomposed", () => {
    // "e" + combining acute is two characters in the item and one letter to the reader.
    const decomposed = "été ok";
    expect(findMatches(items(decomposed), "ete")).toEqual([[{ item: 0, start: 0, end: 5 }]]);
    expect(findMatches(items(decomposed), "ok")).toEqual([[{ item: 0, start: 6, end: 8 }]]);
  });

  it("finds matches that run across items on one line", () => {
    expect(findMatches(items("sam", "ple text"), "sample")).toEqual([
      [
        { item: 0, start: 0, end: 3 },
        { item: 1, start: 0, end: 3 },
      ],
    ]);
  });

  it("treats the end of a line as a space", () => {
    const lines = [{ str: "first line", hasEOL: true }, { str: "second line" }];
    expect(findMatches(lines, "line second")).toEqual([
      [
        { item: 0, start: 6, end: 10 },
        { item: 1, start: 0, end: 6 },
      ],
    ]);
    // But the break is only a space, never nothing.
    expect(findMatches(lines, "linesecond")).toEqual([]);
  });

  it("treats runs of white space, non-breaking spaces included, as one space", () => {
    expect(findMatches(items("a  b"), "a b")).toEqual([[{ item: 0, start: 0, end: 4 }]]);
    expect(findMatches(items("a   \tb"), "a b")).toHaveLength(1);
    expect(findMatches(items("a b"), "a   b")).toHaveLength(1);
    // Across items: spaces at the end of one and the start of the next.
    expect(findMatches(items("a ", " b"), "a b")).toEqual([
      [
        { item: 0, start: 0, end: 2 },
        { item: 1, start: 1, end: 2 },
      ],
    ]);
    // And across a line break that has spaces around it.
    expect(findMatches([{ str: "a  ", hasEOL: true }, { str: "  b" }], "a b")).toHaveLength(1);
  });

  it("joins a word cut by a hyphen at the end of a line", () => {
    const lines = [{ str: "the algo-", hasEOL: true }, { str: "rithm works" }];
    expect(findMatches(lines, "algorithm")).toEqual([
      [
        { item: 0, start: 4, end: 9 },
        { item: 1, start: 0, end: 5 },
      ],
    ]);
    expect(findMatches(lines, "algorithm works")).toHaveLength(1);
    // Only after a letter, and only at a line end.
    expect(findMatches([{ str: "5 -", hasEOL: true }, { str: "rithm" }], "5 - rithm")).toHaveLength(1);
    expect(findMatches(items("algo-", "rithm"), "algorithm")).toEqual([]);
    expect(findMatches(items("algo-rithm"), "algo-rithm")).toHaveLength(1);
    // A soft hyphen too.
    expect(findMatches([{ str: "algo­", hasEOL: true }, { str: "rithm" }], "algorithm")).toHaveLength(1);
  });

  it("does not add a second space after an item that already ends with one", () => {
    const lines = [{ str: "a ", hasEOL: true }, { str: "b" }];
    expect(findMatches(lines, "a b")).toHaveLength(1);
  });

  it("does not overlap matches", () => {
    expect(findMatches(items("aaaa"), "aa")).toEqual([
      [{ item: 0, start: 0, end: 2 }],
      [{ item: 0, start: 2, end: 4 }],
    ]);
  });

  it("finds several items one after the other, in order", () => {
    const found = findMatches(items("x relation", "y", "relation z"), "relation");
    expect(found.map((m) => m[0].item)).toEqual([0, 2]);
  });

  it("finds nothing for an empty query, a blank one or text that is not there", () => {
    expect(findMatches(items("abc"), "")).toEqual([]);
    expect(findMatches(items("abc"), "   ")).toEqual([]);
    expect(findMatches(items("abc"), "xyz")).toEqual([]);
    expect(findMatches([], "abc")).toEqual([]);
  });

  it("matches a query with special characters literally", () => {
    expect(findMatches(items("f(x) = a.b*c"), "(x) = a.b*")).toHaveLength(1);
  });

  it("handles characters outside the basic plane", () => {
    expect(findMatches(items("a \u{1d4d0}b c"), "b c")).toEqual([[{ item: 0, start: 4, end: 7 }]]);
  });
});

describe("a whole search", () => {
  const result = buildResult(
    "x",
    new Map([
      [5, [[{ item: 0, start: 0, end: 1 }]]],
      [2, [[{ item: 1, start: 0, end: 1 }], [{ item: 3, start: 0, end: 1 }]]],
      [3, []],
    ]),
  );

  it("lists matches in reading order and leaves out pages without any", () => {
    expect(result.flat).toEqual([
      { page: 2, index: 0 },
      { page: 2, index: 1 },
      { page: 5, index: 0 },
    ]);
    expect([...result.byPage.keys()]).toEqual([2, 5]);
  });

  it("starts at the first match on the page being read or after it", () => {
    expect(firstMatchFrom(result, 1)).toBe(0);
    expect(firstMatchFrom(result, 3)).toBe(2);
    expect(firstMatchFrom(result, 5)).toBe(2);
    // Nothing after: back to the first.
    expect(firstMatchFrom(result, 6)).toBe(0);
  });

  it("steps through the matches and wraps around", () => {
    expect(stepMatch(0, 3, 1)).toBe(1);
    expect(stepMatch(2, 3, 1)).toBe(0);
    expect(stepMatch(0, 3, -1)).toBe(2);
    expect(stepMatch(0, 0, 1)).toBe(0);
  });

  it("words the count", () => {
    expect(countLabel(null, 0)).toBe("");
    expect(countLabel(result, 1)).toBe("2 of 3");
    expect(countLabel(buildResult("x", new Map()), 0)).toBe("No matches");
  });
});

import { describe, expect, it } from "vitest";
import { descriptionSnippet, markText, snippetAround } from "./highlight";
import { findPrefixRanges, foldedWords, foldQuery, foldWithMap } from "./text-fold";

describe("foldQuery and foldedWords", () => {
  it("folds case, accents and white space", () => {
    expect(foldQuery("  École  Été ")).toBe("ecole ete");
    expect(foldedWords("Théorie des graphes, 2e partie!")).toEqual(["theorie", "des", "graphes", "2e", "partie"]);
  });
});

describe("foldWithMap", () => {
  it("keeps where each folded character came from", () => {
    const folded = foldWithMap("Été");
    expect(folded.text).toBe("ete");
    expect(folded.starts).toEqual([0, 1, 2]);
    expect(folded.ends).toEqual([1, 2, 3]);
  });

  it("covers a letter stored decomposed in one range", () => {
    const folded = foldWithMap("ét");
    expect(folded.text).toBe("et");
    expect(folded.starts[1]).toBe(2);
  });
});

describe("findPrefixRanges", () => {
  it("marks the start of a word that begins with the term, whatever its case", () => {
    expect(findPrefixRanges("Relational databases", ["relation"])).toEqual([{ start: 0, end: 8 }]);
    expect(findPrefixRanges("The RELATION", ["relation"])).toEqual([{ start: 4, end: 12 }]);
  });

  it("does not mark the middle of a word", () => {
    expect(findPrefixRanges("Correlation", ["relation"])).toEqual([]);
  });

  it("matches without accents in either direction", () => {
    expect(findPrefixRanges("Théorie des graphes", ["theorie"])).toEqual([{ start: 0, end: 7 }]);
    expect(findPrefixRanges("theorie", ["théorie"].map(foldQuery))).toEqual([{ start: 0, end: 7 }]);
  });

  it("marks several words and several matches in reading order", () => {
    expect(findPrefixRanges("Graphs and trees, then graph theory", ["graph", "tree"])).toEqual([
      { start: 0, end: 5 },
      { start: 11, end: 15 },
      { start: 23, end: 28 },
    ]);
  });

  it("marks as far as the longest term reaches", () => {
    expect(findPrefixRanges("DEMO301", ["demo", "301", "demo301"])).toEqual([{ start: 0, end: 7 }]);
    expect(findPrefixRanges("DEMO301", ["demo"])).toEqual([{ start: 0, end: 4 }]);
  });

  it("returns original positions when accents are present", () => {
    expect(findPrefixRanges("Étude de cas, étapes", ["etap"])).toEqual([{ start: 14, end: 18 }]);
  });

  it("finds nothing for an empty term list", () => {
    expect(findPrefixRanges("Anything", [])).toEqual([]);
    expect(findPrefixRanges("Anything", [""])).toEqual([]);
    expect(findPrefixRanges("", ["a"])).toEqual([]);
  });
});

describe("markText", () => {
  it("returns the whole text with its marks", () => {
    expect(markText("Lecture 3", ["lect"])).toEqual({ text: "Lecture 3", ranges: [{ start: 0, end: 4 }], before: false, after: false });
  });
});

describe("snippetAround", () => {
  const filler = "lorem ipsum dolor sit amet ".repeat(10);

  it("returns null when nothing matches", () => {
    expect(snippetAround("Nothing here", ["relation"])).toBeNull();
  });

  it("returns a short description whole", () => {
    expect(snippetAround("Join the two tables on a relation.", ["relation"])).toEqual({
      text: "Join the two tables on a relation.",
      ranges: [{ start: 25, end: 33 }],
      before: false,
      after: false,
    });
  });

  it("cuts a long description to about 120 characters around the first match, at spaces", () => {
    const text = `${filler}describe the resulting relation of the join ${filler}`;
    const snippet = snippetAround(text, ["relation"])!;
    expect(snippet.text.length).toBeLessThanOrEqual(120);
    expect(snippet.text.length).toBeGreaterThan(60);
    expect(snippet.before).toBe(true);
    expect(snippet.after).toBe(true);
    expect(snippet.text.startsWith(" ")).toBe(false);
    expect(snippet.text).toContain("relation");
    expect(snippet.ranges).toHaveLength(1);
    expect(snippet.text.slice(snippet.ranges[0].start, snippet.ranges[0].end)).toBe("relation");
    expect(text).toContain(snippet.text);
  });

  it("starts at the beginning when the match is early", () => {
    const snippet = snippetAround(`Relation basics. ${filler}`, ["relation"])!;
    expect(snippet.before).toBe(false);
    expect(snippet.after).toBe(true);
    expect(snippet.ranges).toEqual([{ start: 0, end: 8 }]);
  });

  it("keeps a match that sits at the very end", () => {
    const snippet = snippetAround(`${filler}ends with relation`, ["relation"])!;
    expect(snippet.after).toBe(false);
    expect(snippet.text.endsWith("relation")).toBe(true);
  });

  it("copes with a long text that has no spaces", () => {
    const snippet = snippetAround(`${"x".repeat(200)}relation${"y".repeat(200)}`, ["relation"]);
    expect(snippet).toBeNull();
    const spaced = snippetAround(`${"x".repeat(200)} relation ${"y".repeat(200)}`, ["relation"])!;
    expect(spaced.ranges).toHaveLength(1);
  });
});

describe("descriptionSnippet", () => {
  it("shows the description for words the title lacks", () => {
    const snippet = descriptionSnippet("Sample lecture", "An introduction to graphs.", ["sample", "graph"])!;
    expect(snippet.text).toBe("An introduction to graphs.");
    expect(snippet.ranges).toEqual([{ start: 19, end: 24 }]);
  });

  it("shows nothing when the title has every word, or there is no description or match", () => {
    expect(descriptionSnippet("Graph theory", "About graph theory.", ["graph", "theory"])).toBeNull();
    expect(descriptionSnippet("Sample", null, ["graph"])).toBeNull();
    expect(descriptionSnippet("Sample", "Nothing here.", ["graph"])).toBeNull();
  });
});

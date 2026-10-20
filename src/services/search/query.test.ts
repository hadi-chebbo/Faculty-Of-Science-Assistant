import { describe, expect, it } from "vitest";
import { chipForTypes, clipQuery, filterTypes, highlightTerms, joinedCode, parseSearchQuery, SEARCH_MAX_LENGTH, searchLength } from "./query";

describe("parseSearchQuery", () => {
  it("folds case and accents and splits into words", () => {
    expect(parseSearchQuery("  Théorie   des GRAPHES ").words).toEqual(["theorie", "des", "graphes"]);
  });

  it("takes type words out of the text and keeps them as filters, in English and French", () => {
    expect(parseSearchQuery("graphs exam")).toMatchObject({ words: ["graphs"], types: ["exam"] });
    expect(parseSearchQuery("examens")).toMatchObject({ words: [], types: ["exam"] });
    expect(parseSearchQuery("cours graphes")).toMatchObject({ words: ["graphes"], types: ["lecture"] });
    expect(parseSearchQuery("note")).toMatchObject({ types: ["notes"] });
    expect(parseSearchQuery("TD 3")).toMatchObject({ words: ["3"], types: ["exercise"] });
    expect(parseSearchQuery("exercice")).toMatchObject({ types: ["exercise"] });
    expect(parseSearchQuery("Corrigé")).toMatchObject({ words: [], types: ["solution"] });
    expect(parseSearchQuery("solutions")).toMatchObject({ types: ["solution"] });
  });

  it("takes session words out of the text, in English and French", () => {
    expect(parseSearchQuery("final")).toMatchObject({ words: [], sessions: ["final"] });
    expect(parseSearchQuery("partiel")).toMatchObject({ sessions: ["partial"] });
    expect(parseSearchQuery("partial")).toMatchObject({ sessions: ["partial"] });
    expect(parseSearchQuery("rattrapage")).toMatchObject({ sessions: ["second"] });
    expect(parseSearchQuery("second")).toMatchObject({ sessions: ["second"] });
  });

  it("reads a year as the start of an academic year", () => {
    expect(parseSearchQuery("final 2024")).toEqual({ words: [], types: [], sessions: ["final"], year: 2024 });
    expect(parseSearchQuery("2024-2025").year).toBe(2024);
    expect(parseSearchQuery("2024/2025").year).toBe(2024);
    expect(parseSearchQuery("2024-2025").words).toEqual([]);
  });

  it("does not take a number that is not an academic year", () => {
    expect(parseSearchQuery("301")).toMatchObject({ words: ["301"], year: null });
    expect(parseSearchQuery("2024-2027")).toMatchObject({ year: null, words: ["2024", "2027"] });
    expect(parseSearchQuery("1800")).toMatchObject({ year: null, words: ["1800"] });
    expect(parseSearchQuery("20245")).toMatchObject({ year: null, words: ["20245"] });
  });

  it("uses only the first year; a second one stays text", () => {
    expect(parseSearchQuery("2023 2024")).toMatchObject({ year: 2023, words: ["2024"] });
  });

  it("recognises a filter word next to punctuation", () => {
    expect(parseSearchQuery("(final), exams!")).toMatchObject({ words: [], types: ["exam"], sessions: ["final"] });
  });

  it("leaves the empty text when every word is a filter", () => {
    expect(parseSearchQuery("final exam 2024-2025").words).toEqual([]);
  });

  it("keeps a code typed with a space as two words", () => {
    expect(parseSearchQuery("demo 301")).toMatchObject({ words: ["demo", "301"], year: null });
  });

  it("splits on punctuation so that no operator survives", () => {
    expect(parseSearchQuery("a&b|c!d:e(f)g<->h'i\\j*").words).toEqual(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);
    expect(parseSearchQuery("&|!:()").words).toEqual([]);
  });

  it("keeps a session word as text next to plain words, and as a filter otherwise", () => {
    expect(parseSearchQuery("partial derivatives")).toMatchObject({ words: ["partial", "derivatives"], sessions: [] });
    expect(parseSearchQuery("second order equations")).toMatchObject({ words: ["second", "order", "equations"], sessions: [] });
    expect(parseSearchQuery("final 2024")).toMatchObject({ words: [], sessions: ["final"], year: 2024 });
    expect(parseSearchQuery("final exam")).toMatchObject({ words: [], sessions: ["final"], types: ["exam"] });
    expect(parseSearchQuery("final")).toMatchObject({ words: [], sessions: ["final"] });
    expect(parseSearchQuery("partiel rattrapage")).toMatchObject({ words: [], sessions: ["partial", "second"] });
    // With a year or a type word, session words are filters even beside other words.
    expect(parseSearchQuery("partial derivatives 2024")).toMatchObject({ words: ["derivatives"], sessions: ["partial"] });
    expect(parseSearchQuery("graphs final exam")).toMatchObject({ words: ["graphs"], sessions: ["final"] });
  });

  it("limits the number of words", () => {
    expect(parseSearchQuery(Array.from({ length: 50 }, (_, i) => `w${i}`).join(" ")).words).toHaveLength(12);
  });

  it("does not treat inherited object keys as filter words", () => {
    expect(parseSearchQuery("constructor toString __proto__").words).toEqual(["constructor", "tostring", "proto"]);
  });
});

describe("the length of a query", () => {
  it("counts characters, not UTF-16 units", () => {
    expect(searchLength("𝐀𝐀")).toBe(2);
    expect("𝐀𝐀".length).toBe(4);
    expect(searchLength("e\u0301")).toBe(2);
  });

  it("cuts to the longest length without splitting a character", () => {
    const clipped = clipQuery("𝐀".repeat(150));
    expect(searchLength(clipped)).toBe(SEARCH_MAX_LENGTH);
    expect(clipped).toBe("𝐀".repeat(SEARCH_MAX_LENGTH));
    expect(clipQuery("  hello  ")).toBe("hello");
    expect(clipQuery(`${"a".repeat(99)} ${"b".repeat(10)}`)).toBe("a".repeat(99));
  });
});

describe("joinedCode and highlightTerms", () => {
  it("joins the words as a course code is written", () => {
    expect(joinedCode(["demo", "301"])).toBe("demo301");
  });

  it("marks each word, and the joined form when there are several", () => {
    expect(highlightTerms(["algo"])).toEqual(["algo"]);
    expect(highlightTerms(["demo", "301"])).toEqual(["demo", "301", "demo301"]);
    expect(highlightTerms([])).toEqual([]);
  });
});

describe("chips from the words", () => {
  it("selects the chip that shows exactly the asked kinds", () => {
    expect(chipForTypes(["exam"])).toBe("exam");
    expect(chipForTypes(["lecture", "notes"])).toBe("lecture");
    expect(chipForTypes(["notes"])).toBe("lecture");
    expect(chipForTypes(["exercise"])).toBe("exercise");
  });

  it("selects no chip for solutions or a mix", () => {
    expect(chipForTypes(["solution"])).toBe("all");
    expect(chipForTypes(["exam", "lecture"])).toBe("all");
    expect(chipForTypes([])).toBe("all");
  });

  it("treats an exam session as asking for exams", () => {
    expect(filterTypes(parseSearchQuery("final"))).toEqual(["exam"]);
    expect(filterTypes(parseSearchQuery("final lecture"))).toEqual(["lecture"]);
    expect(filterTypes(parseSearchQuery("graphs"))).toEqual([]);
  });
});

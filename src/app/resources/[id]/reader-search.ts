// Finding text in a PDF page, kept free of React and the DOM so it can be tested.
//
// A page's text comes from PDF.js as a list of items (the pieces the file draws, usually a word or
// a line each). A match is reported as the parts of items it covers, in each item's own characters,
// so the reader can mark exactly those characters on the page's text layer.

import { foldCodePoint, foldQuery } from "@/lib/text-fold";

// The reader's tests and hooks take the folding from here.
export { foldQuery };

export interface TextItemLike {
  str: string;
  // PDF.js sets this on an item that ends a line.
  hasEOL?: boolean;
}

export interface MatchPart {
  // Index into the page's items.
  item: number;
  // Characters of that item's `str`, end exclusive.
  start: number;
  end: number;
}

// One match; it has more than one part when it runs across items.
export type PageMatch = MatchPart[];

// A page's text folded once, with where every folded character came from. Built the first time a
// page is searched and kept, so later searches only look for the new query in it.
export interface PageText {
  haystack: string;
  // For every folded character: which item and character it came from (item -1 for a line break).
  itemOf: number[];
  startOf: number[];
  lengthOf: number[];
}

export const EMPTY_PAGE_TEXT: PageText = { haystack: "", itemOf: [], startOf: [], lengthOf: [] };

// A hyphen that ends a line after a letter: the word goes on in the next item.
const LINE_END_HYPHEN = /\p{L}[-­‐]$/u;

// Folds a page's items into one searchable text:
// - runs of white space (non-breaking spaces included), inside an item and across items, are one space;
// - a line break between items counts as a space, but items on the same line join with none, so a
//   word the file draws in two pieces is still one word;
// - a word cut by a hyphen at the end of a line is joined ("algo-" then "rithm" reads "algorithm");
//   the hyphen is dropped from the text but still belongs to the letter before it, so a match is
//   marked over it too. (A real hyphen at a line end, as in "well-" "known", is joined as well.)
export function prepareText(items: readonly TextItemLike[]): PageText {
  let haystack = "";
  const itemOf: number[] = [];
  const startOf: number[] = [];
  const lengthOf: number[] = [];
  // A character that folds to nothing, or a space that adds nothing, belongs to the one before it.
  const absorb = (index: number, length: number) => {
    if (itemOf.length > 0 && itemOf[itemOf.length - 1] === index) lengthOf[lengthOf.length - 1] += length;
  };

  items.forEach((item, index) => {
    let offset = 0;
    const joinsNext = item.hasEOL === true && LINE_END_HYPHEN.test(item.str);
    const chars = Array.from(item.str);
    chars.forEach((char, i) => {
      const length = char.length;
      const folded = foldCodePoint(char);
      const isJoiningHyphen = joinsNext && i === chars.length - 1;
      if (folded === "" || isJoiningHyphen || (folded === " " && (haystack === "" || haystack.endsWith(" ")))) {
        absorb(index, length);
      } else {
        for (let k = 0; k < folded.length; k++) {
          itemOf.push(index);
          startOf.push(offset);
          lengthOf.push(length);
        }
        haystack += folded;
      }
      offset += length;
    });
    if (item.hasEOL && !joinsNext && haystack !== "" && !haystack.endsWith(" ")) {
      haystack += " ";
      itemOf.push(-1);
      startOf.push(0);
      lengthOf.push(0);
    }
  });
  return { haystack, itemOf, startOf, lengthOf };
}

// All matches of an already folded `needle` in a prepared page, in reading order, no overlaps.
export function findInText(text: PageText, needle: string): PageMatch[] {
  if (!needle) return [];
  const { haystack, itemOf, startOf, lengthOf } = text;
  const matches: PageMatch[] = [];
  for (let from = haystack.indexOf(needle); from !== -1; from = haystack.indexOf(needle, from + needle.length)) {
    const parts: MatchPart[] = [];
    for (let i = from; i < from + needle.length; i++) {
      const item = itemOf[i];
      if (item === -1) continue;
      const start = startOf[i];
      const end = start + lengthOf[i];
      const last = parts[parts.length - 1];
      if (last && last.item === item && start <= last.end) last.end = Math.max(last.end, end);
      else parts.push({ item, start, end });
    }
    if (parts.length > 0) matches.push(parts);
  }
  return matches;
}

// Convenience for one-off use (and tests): fold the items and look for `query` in them.
export function findMatches(items: readonly TextItemLike[], query: string): PageMatch[] {
  return findInText(prepareText(items), foldQuery(query));
}

// Every match of a search, page by page and as one list in reading order.
export interface SearchResult {
  term: string;
  // Matches of each page (1-based keys); a page without matches is absent.
  byPage: Map<number, PageMatch[]>;
  // The same matches in reading order: which page, and which of that page's matches.
  flat: { page: number; index: number }[];
}

export function buildResult(term: string, perPage: ReadonlyMap<number, PageMatch[]>): SearchResult {
  const byPage = new Map<number, PageMatch[]>();
  const flat: SearchResult["flat"] = [];
  for (const page of [...perPage.keys()].sort((a, b) => a - b)) {
    const matches = perPage.get(page)!;
    if (matches.length === 0) continue;
    byPage.set(page, matches);
    matches.forEach((_, index) => flat.push({ page, index }));
  }
  return { term, byPage, flat };
}

// Where a new search starts: the first match on the page being read or after it, else the first.
export function firstMatchFrom(result: SearchResult, page: number): number {
  const found = result.flat.findIndex((match) => match.page >= page);
  return found === -1 ? 0 : found;
}

// Next and previous wrap around the ends.
export function stepMatch(current: number, total: number, direction: 1 | -1): number {
  return total === 0 ? 0 : (current + direction + total) % total;
}

// What the count reads: "3 of 17", "No matches", or nothing before anything was searched.
export function countLabel(result: SearchResult | null, current: number): string {
  if (!result) return "";
  return result.flat.length === 0 ? "No matches" : `${current + 1} of ${result.flat.length}`;
}

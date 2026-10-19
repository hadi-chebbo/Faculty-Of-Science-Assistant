// Finding text in a PDF page, kept free of React and the DOM so it can be tested.
//
// A page's text comes from PDF.js as a list of items (the pieces the file draws, usually a word or
// a line each). A match is reported as the parts of items it covers, in each item's own characters,
// so the reader can mark exactly those characters on the page's text layer.

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

// Lower case, without accents, and any white space as a single plain space: "Été" and "ete" fold to
// the same text. Works one character at a time so the position of every folded character in the
// original text is known.
function foldCodePoint(char: string): string {
  if (/^\s$/u.test(char)) return " ";
  return char.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function foldQuery(query: string): string {
  return Array.from(query.trim().replace(/\s+/gu, " "), foldCodePoint).join("");
}

// All matches of `query` on a page, in reading order and without overlaps. A line break between
// items counts as a space, so a phrase can be found across two lines; items on the same line are
// joined without one, so a word the file draws in two pieces is still one word.
export function findMatches(items: readonly TextItemLike[], query: string): PageMatch[] {
  const needle = foldQuery(query);
  if (!needle) return [];

  let haystack = "";
  // For every folded character: which item and character it came from (item -1 for a line break).
  const itemOf: number[] = [];
  const startOf: number[] = [];
  const lengthOf: number[] = [];
  items.forEach((item, index) => {
    let offset = 0;
    for (const char of item.str) {
      const folded = foldCodePoint(char);
      // A combining accent folds away to nothing: it belongs to the letter before it.
      if (folded === "" && itemOf[itemOf.length - 1] === index) lengthOf[lengthOf.length - 1] += char.length;
      for (let i = 0; i < folded.length; i++) {
        itemOf.push(index);
        startOf.push(offset);
        lengthOf.push(char.length);
      }
      haystack += folded;
      offset += char.length;
    }
    if (item.hasEOL && !haystack.endsWith(" ")) {
      haystack += " ";
      itemOf.push(-1);
      startOf.push(0);
      lengthOf.push(0);
    }
  });

  const matches: PageMatch[] = [];
  for (let from = haystack.indexOf(needle); from !== -1; from = haystack.indexOf(needle, from + needle.length)) {
    const parts: MatchPart[] = [];
    for (let i = from; i < from + needle.length; i++) {
      const item = itemOf[i];
      if (item === -1) continue;
      const start = startOf[i];
      const end = start + lengthOf[i];
      const last = parts[parts.length - 1];
      // One original character can fold to several; consecutive characters of one item merge.
      if (last && last.item === item && start <= last.end) last.end = Math.max(last.end, end);
      else parts.push({ item, start, end });
    }
    if (parts.length > 0) matches.push(parts);
  }
  return matches;
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

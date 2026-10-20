import { findPrefixRanges, type TextRange } from "./text-fold";

// The text and the parts of it to mark. `before` and `after` say that the text was cut there.
export interface Marked {
  text: string;
  ranges: TextRange[];
  before: boolean;
  after: boolean;
}

export function markText(text: string, terms: readonly string[]): Marked {
  return { text, ranges: findPrefixRanges(text, terms), before: false, after: false };
}

// A snippet of the description for the words the title lacks (a file may match through its
// description); null when the title has them all, or the description has none of the others.
export function descriptionSnippet(title: string, description: string | null, terms: readonly string[]): Marked | null {
  if (!description) return null;
  const missing = terms.filter((term) => findPrefixRanges(title, [term]).length === 0);
  return missing.length > 0 ? snippetAround(description, missing) : null;
}

const SNIPPET_LENGTH = 120;
// How much text to show before the first match.
const LEAD = 40;

// About 120 characters of `text` around its first match, cut at spaces, or null when `text` holds
// no match. The marks are worked out again on the cut text so they stay inside it.
export function snippetAround(text: string, terms: readonly string[]): Marked | null {
  const first = findPrefixRanges(text, terms)[0];
  if (!first) return null;
  if (text.length <= SNIPPET_LENGTH) return markText(text, terms);

  let start = Math.max(0, first.start - LEAD);
  if (start > 0) {
    // Begin at a word: after the next space, if that is still before the match.
    const space = text.indexOf(" ", start);
    start = space !== -1 && space < first.start ? space + 1 : first.start;
  }
  let end = Math.min(text.length, start + SNIPPET_LENGTH);
  if (end < text.length) {
    // End at a word: before the last space, if the match is still inside.
    const space = text.lastIndexOf(" ", end);
    if (space > first.end) end = space;
  }
  const cut = text.slice(start, end);
  return { text: cut, ranges: findPrefixRanges(cut, terms), before: start > 0, after: end < text.length };
}

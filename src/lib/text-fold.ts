// Folding text so that capitals, accents and the kind of white space do not matter. Shared by the
// document reader's search and the site search, so the two agree on what "the same text" is.

// Lower case, without accents, and any white space as a single plain space: "Été" and "ete" fold to
// the same text. Works one character at a time so the position of every folded character in the
// original text is known.
export function foldCodePoint(char: string): string {
  if (/^\s$/u.test(char)) return " ";
  return char.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function foldQuery(query: string): string {
  return Array.from(query.trim().replace(/\s+/gu, " "), foldCodePoint).join("");
}

// The folded text with, for every folded character, the span of the original text it came from
// (end exclusive, in UTF-16 units). A character that folds to nothing (a combining mark on its own)
// has no entry; the one before it simply covers it.
export interface FoldedText {
  text: string;
  starts: number[];
  ends: number[];
}

export function foldWithMap(original: string): FoldedText {
  let text = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const char of original) {
    const folded = foldCodePoint(char);
    for (let i = 0; i < folded.length; i++) {
      starts.push(offset);
      ends.push(offset + char.length);
    }
    text += folded;
    offset += char.length;
  }
  return { text, starts, ends };
}

// A run of letters or digits: what counts as a word in a search.
const WORD = /[\p{L}\p{Nd}]+/gu;

// The words of a text, folded. Everything that is not a letter or a digit separates words, so
// "algo-rithm" is two words and punctuation never reaches a search query.
export function foldedWords(text: string): string[] {
  return foldQuery(text).match(WORD) ?? [];
}

export interface TextRange {
  start: number;
  end: number;
}

// Where `text` has a word that starts with one of the (folded) `prefixes`: the matched part of
// that word, as a range in the original text. A word starting with several prefixes is marked as
// far as the longest one reaches. Ranges come out in reading order and never overlap.
export function findPrefixRanges(text: string, prefixes: readonly string[]): TextRange[] {
  const wanted = prefixes.filter((prefix) => prefix !== "");
  if (wanted.length === 0 || text === "") return [];
  const folded = foldWithMap(text);
  const ranges: TextRange[] = [];
  for (const word of folded.text.matchAll(WORD)) {
    const from = word.index;
    let longest = 0;
    for (const prefix of wanted) {
      if (prefix.length > longest && word[0].startsWith(prefix)) longest = prefix.length;
    }
    if (longest > 0) ranges.push({ start: folded.starts[from], end: folded.ends[from + longest - 1] });
  }
  return ranges;
}

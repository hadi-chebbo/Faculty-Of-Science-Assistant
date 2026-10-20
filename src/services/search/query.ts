// Turning what a visitor typed into something the database can search, with no database and no
// framework in sight so it can be tested on its own.
//
// A query is split into words. Words that name a resource type, an exam session or an academic
// year also act as filters on files and are taken out of the text that is searched; the rest are
// the text words. Every text word is folded (lower case, no accents) and reduced to letters and
// digits, so punctuation never reaches the database as search syntax.

import { ACADEMIC_YEAR_MAX, ACADEMIC_YEAR_MIN } from "@/db/constants";
import type { ExamSession, ResourceType } from "@/db/constants";
import { foldQuery, WORD } from "@/lib/text-fold";

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;
// A hundred characters hold at most 50 words; more than this many are ignored.
const MAX_TEXT_WORDS = 12;

// The one rule for the length of a query: characters (code points), not UTF-16 units, so an
// astral character counts once everywhere.
export function searchLength(text: string): number {
  return Array.from(text).length;
}

// Trimmed and cut to the longest length; for text that comes from an address and must never be
// an error.
export function clipQuery(text: string): string {
  return Array.from(text.trim()).slice(0, SEARCH_MAX_LENGTH).join("").trim();
}

// Words that are filters, written folded (no accents, lower case). Both English and French.
const TYPE_WORDS: Record<string, ResourceType> = {
  exam: "exam",
  exams: "exam",
  examen: "exam",
  examens: "exam",
  lecture: "lecture",
  lectures: "lecture",
  cours: "lecture",
  notes: "notes",
  note: "notes",
  exercise: "exercise",
  exercises: "exercise",
  exercice: "exercise",
  exercices: "exercise",
  td: "exercise",
  solution: "solution",
  solutions: "solution",
  corrige: "solution",
  corriges: "solution",
};

const SESSION_WORDS: Record<string, ExamSession> = {
  partial: "partial",
  partiel: "partial",
  final: "final",
  second: "second",
  rattrapage: "second",
};

export interface ParsedQuery {
  // The text words to look for: folded, only letters and digits.
  words: string[];
  // Filters taken from words of the query; empty when the query has none of that kind.
  types: ResourceType[];
  sessions: ExamSession[];
  year: number | null;
}

export function parseSearchQuery(raw: string): ParsedQuery {
  const types: ResourceType[] = [];
  const year = { value: null as number | null };
  // What is neither a type nor a year, in order; a session word is one of these until it is known
  // to be a filter.
  const rest: { token: string; session?: ExamSession }[] = [];

  for (const spaced of foldQuery(raw).split(" ")) {
    // "exams," and "(final)" are the words exams and final.
    const token = spaced.replace(/^[^\p{L}\p{Nd}]+|[^\p{L}\p{Nd}]+$/gu, "");
    if (token === "") continue;
    const type = Object.hasOwn(TYPE_WORDS, token) ? TYPE_WORDS[token] : undefined;
    if (type) {
      if (!types.includes(type)) types.push(type);
      continue;
    }
    if (year.value === null) {
      const start = academicYearStart(token);
      if (start !== null) {
        year.value = start;
        continue;
      }
    }
    rest.push({ token, session: Object.hasOwn(SESSION_WORDS, token) ? SESSION_WORDS[token] : undefined });
  }

  // "final 2024" and "exam partiel" ask for exams of a session, and "final" alone is a session
  // too. But "partial derivatives" and "second order equations" are about mathematics: next to
  // other plain words a session word is a text word.
  const sessionsFilter = year.value !== null || types.length > 0 || rest.every((r) => r.session !== undefined);
  const sessions: ExamSession[] = [];
  const words: string[] = [];
  for (const { token, session } of rest) {
    if (session && sessionsFilter) {
      if (!sessions.includes(session)) sessions.push(session);
    } else {
      for (const word of token.match(WORD) ?? []) words.push(word);
    }
  }
  return { words: words.slice(0, MAX_TEXT_WORDS), types, sessions, year: year.value };
}

// "2024" is the year 2024-2025; "2024-2025" and "2024/2025" say the same. Anything else, including
// a range that is not one year long, is not a year filter.
function academicYearStart(token: string): number | null {
  const match = /^(\d{4})(?:[-/](\d{4}))?$/u.exec(token);
  if (!match) return null;
  const start = Number(match[1]);
  if (start < ACADEMIC_YEAR_MIN || start > ACADEMIC_YEAR_MAX) return null;
  if (match[2] !== undefined && Number(match[2]) !== start + 1) return null;
  return start;
}

// What the words make when the spaces are taken out: "demo 301" is "demo301", the way a course code
// is written.
export function joinedCode(words: readonly string[]): string {
  return words.join("");
}

// What to mark in a result: each word, and the joined form (for a course code typed with a space).
export function highlightTerms(words: readonly string[]): string[] {
  if (words.length === 0) return [];
  return words.length > 1 ? [...words, joinedCode(words)] : [...words];
}

// The chips of the results page and the kinds of file each one shows.
export const SEARCH_CHIPS = ["all", "course", "lecture", "exercise", "exam"] as const;
export type SearchChip = (typeof SEARCH_CHIPS)[number];

export const CHIP_TYPES: Record<SearchChip, readonly ResourceType[] | null> = {
  all: null,
  course: null,
  lecture: ["lecture", "notes"],
  exercise: ["exercise"],
  exam: ["exam"],
};

// Which sections of results each chip shows.
export const CHIP_SECTIONS: Record<SearchChip, { courses: boolean; chapters: boolean; files: boolean }> = {
  all: { courses: true, chapters: true, files: true },
  course: { courses: true, chapters: false, files: false },
  lecture: { courses: false, chapters: false, files: true },
  exercise: { courses: false, chapters: false, files: true },
  exam: { courses: false, chapters: false, files: true },
};

// What the words of a query say about the chip: the kinds of file asked for, and the chip that
// shows exactly those ("exam" selects Exams); no chip when they are mixed or are solutions (which
// only the All view lists). An exam session alone means exams, since only exams have one.
export function filterTypes(parsed: ParsedQuery): ResourceType[] {
  if (parsed.types.length === 0 && parsed.sessions.length > 0) return ["exam"];
  return parsed.types;
}

export function chipForTypes(types: readonly ResourceType[]): SearchChip {
  if (types.length === 0) return "all";
  for (const chip of ["lecture", "exercise", "exam"] as const) {
    const allowed = CHIP_TYPES[chip]!;
    if (types.every((type) => allowed.includes(type))) return chip;
  }
  return "all";
}

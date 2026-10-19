import type { ExamSession, ResourceType } from "@/db/constants";
import type { ResourceListItem } from "../resources/types";
import type { SearchChip } from "./query";
import type { SearchSection } from "./schemas";

export interface CourseHit {
  code: string;
  title: string;
  semester: number;
  chapterCount: number;
  // Published files.
  fileCount: number;
}

export interface ChapterHit {
  position: number;
  title: string;
  courseCode: string;
  courseTitle: string;
  fileCount: number;
}

export interface FileHit {
  resource: ResourceListItem;
  // The chapter it is filed under, if any.
  chapterPosition: number | null;
  // Whether its course has chapters (so a resource with none is "General").
  courseHasChapters: boolean;
}

// One kind of result: how many there are, and the ones to show (the top few, or one page).
export interface SearchGroup<T> {
  total: number;
  items: T[];
}

export interface SearchFilters {
  types: ResourceType[];
  sessions: ExamSession[];
  // Academic year start, as in "2024" for 2024-2025.
  year: number | null;
}

export interface SearchOutcome {
  // "short": nothing to search yet (under two characters), so the page shows its hints.
  state: "short" | "results";
  // The query as the visitor typed it, trimmed.
  query: string;
  // The chip in effect: the one chosen, else the one the words of the query imply.
  chip: SearchChip;
  // The chip the words of the query ask for ("exam" asks for Exams); All when they ask for none.
  impliedChip: SearchChip;
  // The folded words to mark in the results.
  highlight: string[];
  // What the words of the query filter files by.
  filters: SearchFilters;
  // Set when one section is shown in full.
  show: SearchSection | null;
  // A section that was not searched (because of the chip, or because there was no text) is null.
  courses: SearchGroup<CourseHit> | null;
  chapters: SearchGroup<ChapterHit> | null;
  files: SearchGroup<FileHit> | null;
  // Which page of the expanded section this is, and how many there are; 1 and 1 otherwise.
  page: number;
  pages: number;
}

export const SEARCH_PREVIEW_SIZE = 5;
export const SEARCH_PAGE_SIZE = 20;

import { noun } from "@/lib/plural";
import type { HomeStats } from "@/services/courses/home";

// The tiles of the home numbers row. Pure, so the cases the demo data cannot show (no files, no exam,
// exams of a single year, thousands) are covered by unit tests.
export type StatKey = "files" | "courses" | "exams" | "examYears";

export interface StatTile {
  key: StatKey;
  value: string; // "1,204", "2015–2025"
  label: string; // "files", "exam years covered"
}

const number = new Intl.NumberFormat("en-US");

// Empty when there is no published file (the row is then not shown); the two exam tiles only when there is an
// exam. The exam span runs from the start of the first academic year to the end of the last one, so exams of
// 2015-2016 to 2024-2025 read "2015–2025".
export function statTiles(totals: HomeStats["totals"]): StatTile[] {
  if (totals.resources === 0) return [];
  const tiles: StatTile[] = [
    { key: "files", value: number.format(totals.resources), label: noun(totals.resources, "file") },
    { key: "courses", value: number.format(totals.courses), label: noun(totals.courses, "course") },
  ];
  if (totals.exams > 0) {
    tiles.push({ key: "exams", value: number.format(totals.exams), label: `previous ${noun(totals.exams, "exam")}` });
    if (totals.examYears) {
      const { first, last } = totals.examYears;
      tiles.push({ key: "examYears", value: `${first}–${last + 1}`, label: `exam ${noun(last - first + 1, "year")} covered` });
    }
  }
  return tiles;
}

import { yearBadge, yearLabel, type Year } from "@/lib/years";

// The wording of one year card on the home page. Pure, so the cases the demo data cannot
// show (a year with no course, more than four courses) are covered by unit tests.
export interface YearCardText {
  circle: string; // "1", "2", "3" or "M1"
  label: string; // "Second year"
  codes: string[]; // at most CODE_CHIPS
  more: string | null; // "+3 more"
  // null: the year has no course, so the card is not a link and shows `empty` instead.
  counts: string | null;
  empty: string | null;
}

const CODE_CHIPS = 4;

// The strip of totals is only worth showing once there is a catalogue to count.
export const STATS_MIN_COURSES = 5;

export function showStats(courses: number): boolean {
  return courses >= STATS_MIN_COURSES;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function yearCardText(entry: {
  year: Year;
  courseCount: number;
  resourceCount: number;
  courseCodes: string[];
}): YearCardText {
  const base = {
    circle: yearBadge(entry.year),
    label: yearLabel(entry.year),
    codes: entry.courseCodes.slice(0, CODE_CHIPS),
    more: entry.courseCodes.length > CODE_CHIPS ? `+${entry.courseCodes.length - CODE_CHIPS} more` : null,
  };
  if (entry.courseCount > 0) {
    return {
      ...base,
      counts: `${plural(entry.courseCount, "course", "courses")} · ${plural(entry.resourceCount, "file", "files")}`,
      empty: null,
    };
  }
  return { ...base, counts: null, empty: "No courses yet" };
}

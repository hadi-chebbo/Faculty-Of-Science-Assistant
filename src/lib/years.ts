// The year rule: a Year is two consecutive semesters (1-2, 3-4, 5-6, 7-8). Derived, never stored.
// Year 4 is Master 1; students never see the number 4: it is "Master 1", the URL slug "m1" and the badge "M1".
export type Year = 1 | 2 | 3 | 4;

export const YEARS: readonly Year[] = [1, 2, 3, 4];

const LABELS: Record<Year, string> = { 1: "First year", 2: "Second year", 3: "Third year", 4: "Master 1" };

export function yearOfSemester(semester: number): Year {
  return Math.ceil(semester / 2) as Year;
}

export function semestersOfYear(year: Year): [number, number] {
  return [2 * year - 1, 2 * year];
}

export function yearLabel(year: Year): string {
  return LABELS[year];
}

// A year from a URL slug ("1", "2", "3", "m1") or, for callers holding the internal number, 1 to 4; otherwise null.
// The string "4" is not a slug, so /years/4 is the not-found page.
export function parseYear(value: string | number | null | undefined): Year | null {
  if (typeof value === "number") return value === 1 || value === 2 || value === 3 || value === 4 ? value : null;
  if (value === "1" || value === "2" || value === "3") return Number(value) as Year;
  if (value === "m1") return 4;
  return null;
}

// A semester's number inside its year: 1 for the first (odd stored number), 2 for the second.
export function semesterInYear(semester: number): 1 | 2 {
  return semester % 2 === 1 ? 1 : 2;
}

// What students see instead of the stored semester number.
export function semesterLabel(semester: number): string {
  return `Semester ${semesterInYear(semester)}`;
}

export function yearSlug(year: Year): string {
  return year === 4 ? "m1" : String(year);
}

// The short text in a year's circle: "1", "2", "3", "M1".
export function yearBadge(year: Year): string {
  return year === 4 ? "M1" : String(year);
}

// The id of a semester's section on its year page ("semester-1"), never the stored number.
export function semesterAnchor(semester: number): string {
  return `semester-${semesterInYear(semester)}`;
}

// The one place year URLs are built. With a semester it points at that semester's section.
export function yearHref(year: Year, semester?: number): string {
  const base = `/years/${yearSlug(year)}`;
  return semester === undefined ? base : `${base}#${semesterAnchor(semester)}`;
}

// The breadcrumb that leads from a course (or anything in it) back to its year page.
export function yearCrumb(semester: number): { label: string; href: string } {
  const year = yearOfSemester(semester);
  return { label: yearLabel(year), href: yearHref(year, semester) };
}

// Where a course belongs, as students read it: "Second year · Semester 1".
export function courseYearSemesterLabel(semester: number): string {
  return `${yearLabel(yearOfSemester(semester))} · ${semesterLabel(semester)}`;
}

// The stored semester number for a year and a place in it (1 or 2), e.g. (2, 1) → 3. What a form posts.
export function storedSemester(year: Year, place: 1 | 2): number {
  return semestersOfYear(year)[place - 1];
}

// Items grouped under their year, in YEARS order, keeping the items' own order; years with none are left out.
export function groupByYear<T>(items: readonly T[], semesterOf: (item: T) => number): { year: Year; items: T[] }[] {
  return YEARS.map((year) => ({ year, items: items.filter((item) => yearOfSemester(semesterOf(item)) === year) })).filter(
    (group) => group.items.length > 0,
  );
}

// Stored semesters grouped by their year, semesters ascending without repeats.
export function groupSemestersByYear(semesters: readonly number[]): { year: Year; semesters: number[] }[] {
  const sorted = [...new Set(semesters)].sort((a, b) => a - b);
  return groupByYear(sorted, (s) => s).map(({ year, items }) => ({ year, semesters: items }));
}

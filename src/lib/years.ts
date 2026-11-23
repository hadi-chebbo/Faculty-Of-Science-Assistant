// The year rule: a Year is two consecutive semesters (1-2, 3-4, 5-6, 7-8). Derived, never stored.
// Year 4 is Master 1; students never see the number 4: it is "Master 1", the URL slug "m1" and the badge "M1".
export type Year = 1 | 2 | 3 | 4;

export const YEARS: readonly Year[] = [1, 2, 3, 4];

// Everything students see of a year, in one table: its name, its URL slug and the short text in its circle.
const YEAR_INFO: Record<Year, { label: string; slug: string; badge: string }> = {
  1: { label: "First year", slug: "1", badge: "1" },
  2: { label: "Second year", slug: "2", badge: "2" },
  3: { label: "Third year", slug: "3", badge: "3" },
  4: { label: "Master 1", slug: "m1", badge: "M1" },
};

export function yearOfSemester(semester: number): Year {
  return Math.ceil(semester / 2) as Year;
}

export function semestersOfYear(year: Year): [number, number] {
  return [2 * year - 1, 2 * year];
}

export function yearLabel(year: Year): string {
  return YEAR_INFO[year].label;
}

// A year from a URL slug ("1", "2", "3", "m1") or, for callers holding the internal number, 1 to 4; otherwise null.
// The string "4" is not a slug, so /years/4 is the not-found page.
export function parseYear(value: string | number | null | undefined): Year | null {
  if (typeof value === "number") return YEARS.find((year) => year === value) ?? null;
  return YEARS.find((year) => YEAR_INFO[year].slug === value) ?? null;
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
  return YEAR_INFO[year].slug;
}

// The short text in a year's circle: "1", "2", "3", "M1".
export function yearBadge(year: Year): string {
  return YEAR_INFO[year].badge;
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

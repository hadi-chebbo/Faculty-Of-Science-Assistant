// The year rule: a Year is two consecutive semesters (1-2, 3-4, 5-6). Derived, never stored.
export type Year = 1 | 2 | 3;

export const YEARS: readonly Year[] = [1, 2, 3];

const LABELS: Record<Year, string> = { 1: "First year", 2: "Second year", 3: "Third year" };

export function yearOfSemester(semester: number): Year {
  return Math.ceil(semester / 2) as Year;
}

export function semestersOfYear(year: Year): [number, number] {
  return [2 * year - 1, 2 * year];
}

export function yearLabel(year: Year): string {
  return LABELS[year];
}

// A year from a URL segment or number: only 1, 2 or 3 (plain digits), otherwise null.
export function parseYear(value: string | number | null | undefined): Year | null {
  const text = typeof value === "number" ? String(value) : value;
  if (text === "1" || text === "2" || text === "3") return Number(text) as Year;
  return null;
}

// A semester's number inside its year: 1 for the first (odd stored number), 2 for the second.
export function semesterInYear(semester: number): 1 | 2 {
  return semester % 2 === 1 ? 1 : 2;
}

// What students see instead of the stored 1-6 number.
export function semesterLabel(semester: number): string {
  return `Semester ${semesterInYear(semester)}`;
}

export function yearSlug(year: Year): string {
  return String(year);
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

// The year a semester is in, from the number a form posts: the year and its 1-based place in it.
export function storedSemester(year: Year, semesterInYearNumber: 1 | 2): number {
  return semestersOfYear(year)[semesterInYearNumber - 1];
}

// Stored semesters grouped by their year, in YEARS order, semesters ascending; years with none are left out.
export function groupSemestersByYear(semesters: readonly number[]): { year: Year; semesters: number[] }[] {
  return YEARS.map((year) => ({
    year,
    semesters: [...new Set(semesters)].filter((s) => yearOfSemester(s) === year).sort((a, b) => a - b),
  })).filter((group) => group.semesters.length > 0);
}

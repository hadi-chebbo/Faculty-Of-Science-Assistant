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

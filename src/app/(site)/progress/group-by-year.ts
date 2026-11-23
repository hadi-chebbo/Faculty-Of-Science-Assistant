import { groupByYear, type Year } from "@/lib/years";

// My courses grouped under their year: year, then semester, then code (a stable sort, so the
// service's own order breaks any remaining tie). Years without a course are left out.
export function groupCoursesByYear<T extends { code: string; semester: number }>(
  courses: readonly T[],
): { year: Year; courses: T[] }[] {
  const sorted = [...courses].sort((a, b) => a.semester - b.semester || a.code.localeCompare(b.code));
  return groupByYear(sorted, (c) => c.semester).map(({ year, items }) => ({ year, courses: items }));
}

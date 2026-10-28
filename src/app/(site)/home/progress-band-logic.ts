import type { ProgressOverview } from "@/services/progress/types";

export type BandCourse = ProgressOverview["courses"][number];

// At most three of My courses, the most recent completion first.
export function topCourses(courses: BandCourse[], limit = 3): BandCourse[] {
  return [...courses].sort((a, b) => b.lastCompletedAt.localeCompare(a.lastCompletedAt)).slice(0, limit);
}

export function activeDaysText(count: number): string {
  if (count === 0) return "No active days yet this week";
  return `${count} active ${count === 1 ? "day" : "days"} this week`;
}

export function percentOf(done: number, total: number): number {
  return total > 0 ? Math.floor((done / total) * 100) : 0;
}

// The text equivalent of a course row, for the link's accessible name.
export function courseLabel(c: BandCourse): string {
  const base = `${c.code} ${c.title}`;
  if (c.course.total === 0) return `${base}, exams: ${c.exams.done} of ${c.exams.total} done`;
  if (c.course.finished) return `${base}, finished, ${c.course.done} of ${c.course.total} files`;
  return `${base}, ${percentOf(c.course.done, c.course.total)}% done, ${c.course.done} of ${c.course.total} files`;
}

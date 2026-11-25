import type { ProgressOverview } from "@/services/progress/types";
import { filesOf } from "@/lib/plural";
import { RESOURCE_TYPE_SINGULAR_LABELS } from "@/lib/labels";
import type { LastRead } from "@/lib/reader-position";

export type BandCourse = ProgressOverview["courses"][number];

// At most three of My courses, the most recent completion first.
export function topCourses(courses: BandCourse[], limit = 3): BandCourse[] {
  return [...courses].sort((a, b) => b.lastCompletedAt.localeCompare(a.lastCompletedAt)).slice(0, limit);
}

export function activeDaysText(count: number): string {
  if (count === 0) return "No active days yet this week";
  return `${count} active ${count === 1 ? "day" : "days"} this week`;
}

// Home's "Continue where you left off": the remembered file and page are only a place to continue from.
export function resumeHref(resourceId: string, page: number | null): string {
  return `/resources/${resourceId}${page !== null && page > 1 ? `#page=${page}` : ""}`;
}

export function continueMeta(entry: Pick<LastRead, "courseCode" | "type">, page: number | null): string {
  const parts = [entry.courseCode, RESOURCE_TYPE_SINGULAR_LABELS[entry.type]];
  if (page !== null && page > 1) parts.push(`Page ${page}`);
  return parts.join(" · ");
}

export function resumeLabel(title: string, page: number | null): string {
  return page !== null && page > 1 ? `Resume ${title}, page ${page}` : `Resume ${title}`;
}

export function percentOf(done: number, total: number): number {
  return total > 0 ? Math.floor((done / total) * 100) : 0;
}

// The text equivalent of a course row, for the link's accessible name.
export function courseLabel(c: BandCourse): string {
  const base = `${c.code} ${c.title}`;
  if (c.course.total === 0) return `${base}, exams: ${c.exams.done} of ${c.exams.total} done`;
  if (c.course.finished) return `${base}, finished, ${filesOf(c.course.done, c.course.total)}`;
  return `${base}, ${percentOf(c.course.done, c.course.total)}% done, ${filesOf(c.course.done, c.course.total)}`;
}

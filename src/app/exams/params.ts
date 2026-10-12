import { z } from "zod";
import {
  ACADEMIC_YEAR_MAX,
  ACADEMIC_YEAR_MIN,
  COURSE_CODE_MAX_LENGTH,
  EXAM_SESSIONS,
  SEMESTER_MAX,
  SEMESTER_MIN,
} from "@/db/constants";
import type { ExamSession } from "@/db/constants";

export const EXAMS_PAGE_SIZE = 20;
const PAGE_MAX = 10_000;

// What the exams page reads from the URL. Every field is optional except the page.
export interface ExamParams {
  semester?: number;
  course?: string;
  year?: number;
  session?: ExamSession;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

const digits = z.string().regex(/^\d+$/);
const fieldSchemas = {
  semester: digits.transform(Number).pipe(z.number().int().min(SEMESTER_MIN).max(SEMESTER_MAX)),
  course: z.string().trim().min(1).max(COURSE_CODE_MAX_LENGTH),
  year: digits.transform(Number).pipe(z.number().int().min(ACADEMIC_YEAR_MIN).max(ACADEMIC_YEAR_MAX)),
  session: z.enum(EXAM_SESSIONS),
  page: digits.transform(Number).pipe(z.number().int().min(1).max(PAGE_MAX)),
};

// Each parameter is checked on its own and an unusable one is simply dropped: a stale or
// hand-edited link still shows a page. A repeated parameter (?year=1&year=2) counts as its first.
function field<T extends z.ZodType>(raw: RawParams, key: string, schema: T): z.output<T> | undefined {
  const value = Array.isArray(raw[key]) ? raw[key][0] : raw[key];
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function parseExamParams(raw: RawParams): ExamParams {
  return {
    semester: field(raw, "semester", fieldSchemas.semester),
    course: field(raw, "course", fieldSchemas.course),
    year: field(raw, "year", fieldSchemas.year),
    session: field(raw, "session", fieldSchemas.session),
    page: field(raw, "page", fieldSchemas.page) ?? 1,
  };
}

// A course filter that contradicts the semester filter is dropped (the semester wins), and a
// known course is written with its real letter case. An unknown code is kept: it just matches
// no exam and shows the empty state.
export function reconcileCourse(params: ExamParams, courses: { code: string; semester: number }[]): ExamParams {
  if (params.course === undefined) return params;
  const wanted = params.course.toLowerCase();
  const known = courses.find((c) => c.code.toLowerCase() === wanted);
  if (!known) return params;
  if (params.semester !== undefined && known.semester !== params.semester) return { ...params, course: undefined };
  return { ...params, course: known.code };
}

export function hasActiveFilters(params: ExamParams): boolean {
  return (
    params.semester !== undefined ||
    params.course !== undefined ||
    params.year !== undefined ||
    params.session !== undefined
  );
}

// The URL for a set of parameters. The page is left out when it is 1, so the first page and
// the unfiltered list have the plain, shareable address.
export function examsHref(params: ExamParams): string {
  const query = new URLSearchParams();
  if (params.semester !== undefined) query.set("semester", String(params.semester));
  if (params.course !== undefined) query.set("course", params.course);
  if (params.year !== undefined) query.set("year", String(params.year));
  if (params.session !== undefined) query.set("session", params.session);
  if (params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `/exams?${text}` : "/exams";
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

// Where the previous and next links lead; null when there is no such page. The filters stay.
export function pagerLinks(params: ExamParams, total: number, pageSize: number) {
  const pages = totalPages(total, pageSize);
  return {
    pages,
    previous: params.page > 1 && params.page <= pages + 1 ? examsHref({ ...params, page: params.page - 1 }) : null,
    next: params.page < pages ? examsHref({ ...params, page: params.page + 1 }) : null,
  };
}

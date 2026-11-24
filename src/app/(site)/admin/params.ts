import { z } from "zod";
import { COURSE_CODE_MAX_LENGTH } from "@/db/constants";
import { lecturerSlugSchema } from "@/services/lecturers/schemas";

export interface AdminParams {
  course?: string;
  // A lecturer slug.
  lecturer?: string;
  // "scanned": only files with no text on some or all pages.
  text?: "scanned";
  // Only published files or only drafts; none means both.
  status?: "published" | "draft";
  page: number;
}

const course = z.string().trim().min(1).max(COURSE_CODE_MAX_LENGTH);
const lecturer = lecturerSlugSchema;
const text = z.literal("scanned");
const status = z.enum(["published", "draft"]);
const page = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(10_000));

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Unusable values are dropped, never an error.
export function parseAdminParams(raw: Record<string, string | string[] | undefined>): AdminParams {
  const c = course.safeParse(first(raw.course));
  const l = lecturer.safeParse(first(raw.lecturer));
  const t = text.safeParse(first(raw.text));
  const s = status.safeParse(first(raw.status));
  const p = page.safeParse(first(raw.page));
  return { course: c.success ? c.data : undefined, lecturer: l.success ? l.data : undefined, text: t.success ? t.data : undefined, status: s.success ? s.data : undefined, page: p.success ? p.data : 1 };
}

export function adminHref(params: AdminParams): string {
  const query = new URLSearchParams();
  if (params.course !== undefined) query.set("course", params.course);
  if (params.lecturer !== undefined) query.set("lecturer", params.lecturer);
  if (params.text !== undefined) query.set("text", params.text);
  if (params.status !== undefined) query.set("status", params.status);
  if (params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `/admin?${text}` : "/admin";
}

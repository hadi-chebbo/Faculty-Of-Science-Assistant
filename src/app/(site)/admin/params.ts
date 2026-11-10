import { z } from "zod";
import { COURSE_CODE_MAX_LENGTH } from "@/db/constants";

export interface AdminParams {
  course?: string;
  // A lecturer slug.
  lecturer?: string;
  // "scanned": only files with no text on some or all pages.
  text?: "scanned";
  page: number;
}

const course = z.string().trim().min(1).max(COURSE_CODE_MAX_LENGTH);
const lecturer = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
const text = z.literal("scanned");
const page = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(10_000));

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Unusable values are dropped, never an error.
export function parseAdminParams(raw: Record<string, string | string[] | undefined>): AdminParams {
  const c = course.safeParse(first(raw.course));
  const l = lecturer.safeParse(first(raw.lecturer));
  const t = text.safeParse(first(raw.text));
  const p = page.safeParse(first(raw.page));
  return { course: c.success ? c.data : undefined, lecturer: l.success ? l.data : undefined, text: t.success ? t.data : undefined, page: p.success ? p.data : 1 };
}

export function adminHref(params: AdminParams): string {
  const query = new URLSearchParams();
  if (params.course !== undefined) query.set("course", params.course);
  if (params.lecturer !== undefined) query.set("lecturer", params.lecturer);
  if (params.text !== undefined) query.set("text", params.text);
  if (params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `/admin?${text}` : "/admin";
}

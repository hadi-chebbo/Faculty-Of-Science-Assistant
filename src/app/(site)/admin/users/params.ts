import { z } from "zod";
import { EMAIL_MAX_LENGTH } from "@/services/auth/schemas";

export interface UsersParams {
  // Part of an email address.
  q?: string;
  // "unconfirmed": only accounts whose email is not confirmed. An enum so more statuses can be added.
  status?: "unconfirmed";
  page: number;
}

const q = z.string().trim().min(1).max(EMAIL_MAX_LENGTH);
const status = z.literal("unconfirmed");
const page = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(10_000));

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Unusable values are dropped, never an error.
export function parseUsersParams(raw: Record<string, string | string[] | undefined>): UsersParams {
  const qq = q.safeParse(first(raw.q));
  const s = status.safeParse(first(raw.status));
  const p = page.safeParse(first(raw.page));
  return { q: qq.success ? qq.data : undefined, status: s.success ? s.data : undefined, page: p.success ? p.data : 1 };
}

export function usersHref(params: UsersParams): string {
  const query = new URLSearchParams();
  if (params.q !== undefined) query.set("q", params.q);
  if (params.status !== undefined) query.set("status", params.status);
  if (params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `/admin/users?${text}` : "/admin/users";
}

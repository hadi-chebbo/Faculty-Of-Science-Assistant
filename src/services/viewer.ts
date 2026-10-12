import type { UserRole } from "@/db/constants";
import { ForbiddenError } from "./errors";

// Who is asking. null is an anonymous visitor. The caller (page or route handler) works this
// out from a cookie or token; services never read requests themselves.
export type Viewer = { id: string; role: UserRole } | null;

export function isAdmin(viewer: Viewer): boolean {
  return viewer?.role === "admin";
}

export function requireAdmin(viewer: Viewer): asserts viewer is NonNullable<Viewer> {
  if (!isAdmin(viewer)) throw new ForbiddenError();
}

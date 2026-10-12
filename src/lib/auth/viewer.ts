import { cookies } from "next/headers";
import { connection } from "next/server";
import { verifyAccessToken } from "@/services/auth/auth";
import type { Viewer } from "@/services/viewer";
import { ACCESS_COOKIE } from "./cookies";

// Who is signed in, from the access cookie. Reads request data, so call it at request time inside
// a <Suspense> boundary. Only the admin area uses it: public pages always pass a null viewer, so
// they stay free of per-user data and drafts are never rendered outside /admin.
export async function getViewer(): Promise<Viewer> {
  // Checking a token compares its expiry with the current time, which Next.js refuses to do
  // while prerendering; connection() makes sure this only ever runs for a real request.
  await connection();
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

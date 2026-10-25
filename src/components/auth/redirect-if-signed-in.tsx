import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/request";
import { getViewer } from "@/lib/auth/viewer";
import { getAccount } from "@/services/auth/auth";

// Reads the cookie, so render it inside <Suspense>: the form itself stays part of the static shell.
// `searchParams` is the page's promise, awaited only here so the rest of the page stays static.
// A signed-in visitor goes to the safe `?next=` path, otherwise to their role's home.
export async function RedirectIfSignedIn({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const account = await getAccount(await getViewer());
  if (account) {
    const next = (await searchParams)?.next;
    redirect(safeNextPath(typeof next === "string" ? next : null, account.role === "admin" ? "/admin" : "/"));
  }
  return null;
}

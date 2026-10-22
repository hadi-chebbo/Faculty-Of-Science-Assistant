import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { getAccount } from "@/services/auth/auth";

// Reads the cookie, so render it inside <Suspense>: the form itself stays part of the static shell.
export async function RedirectIfSignedIn() {
  const account = await getAccount(await getViewer());
  if (account) redirect(account.role === "admin" ? "/admin" : "/");
  return null;
}

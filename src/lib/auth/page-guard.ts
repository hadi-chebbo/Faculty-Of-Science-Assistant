import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { getAccount } from "@/services/auth/auth";
import type { Viewer } from "@/services/viewer";

// The check every signed-in-only page runs on the server before rendering anything (the admin
// pages and /saved). `nextPath` is where the session-restore route returns to. Returns the
// account and the viewer to pass to services.
export async function requireSignedInPage(nextPath: string) {
  const viewer = await getViewer();
  // No valid access token (never signed in, or it expired): the restore route either renews the
  // session from the refresh cookie and returns here, or sends the visitor to /sign-in?next=….
  const account = await getAccount(viewer);
  if (!account) redirect(`/api/v1/auth/restore?next=${encodeURIComponent(nextPath)}`);
  const signedIn: NonNullable<Viewer> = { id: account.id, role: account.role };
  return { account, viewer: signedIn };
}

// The check for pages that show an in-page sign-in state to a visitor instead of redirecting
// (/saved, /todo, /progress). Returns null without a valid access token. A session that can still
// be renewed is renewed by the browser (`SignedOutState`), because the refresh cookie is scoped to
// /api/v1/auth and a server page never sees it.
export async function getSignedInPageViewer() {
  const viewer = await getViewer();
  const account = await getAccount(viewer);
  if (!account) return null;
  const signedIn: NonNullable<Viewer> = { id: account.id, role: account.role };
  return { account, viewer: signedIn };
}

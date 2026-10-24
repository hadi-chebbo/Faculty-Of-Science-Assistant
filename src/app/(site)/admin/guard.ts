import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { getAccount } from "@/services/auth/auth";
import { ForbiddenError } from "@/services/errors";
import { requireAdmin, type Viewer } from "@/services/viewer";

// The check every admin page runs on the server before rendering anything. `nextPath` is where the
// session-restore route returns to. Returns the account and the viewer to pass to services.
export async function requireAdminPage(nextPath: string) {
  const viewer = await getViewer();
  // No valid access token (never signed in, or it expired): the restore route either renews the
  // session from the refresh cookie and returns here, or sends the visitor to /sign-in.
  const account = await getAccount(viewer);
  if (!account) redirect(`/api/v1/auth/restore?next=${nextPath}`);

  const admin: Viewer = { id: account.id, role: account.role };

  // Checked against the current role in the database, not the token's (up to 15 minutes old).
  try {
    requireAdmin(admin);
  } catch (error) {
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }
  return { account, admin };
}

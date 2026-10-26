import { notFound } from "next/navigation";
import { requireSignedInPage } from "@/lib/auth/page-guard";
import { ForbiddenError } from "@/services/errors";
import { requireAdmin } from "@/services/viewer";

// The check every admin page runs on the server before rendering anything. `nextPath` is where the
// session-restore route returns to. Returns the account and the viewer to pass to services.
export async function requireAdminPage(nextPath: string) {
  const { account, viewer: admin } = await requireSignedInPage(nextPath);

  // Checked against the current role in the database, not the token's (up to 15 minutes old).
  try {
    requireAdmin(admin);
  } catch (error) {
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }
  return { account, admin };
}

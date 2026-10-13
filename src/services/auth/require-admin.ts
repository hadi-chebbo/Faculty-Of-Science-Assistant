import { getAccount } from "./auth";
import { ForbiddenError } from "../errors";
import type { Viewer } from "../viewer";

// The token's role can be up to 15 minutes old, so a write checks the role in the database.
// Runs before input validation: an anonymous caller learns nothing about the input rules.
export async function requireCurrentAdmin(viewer: Viewer): Promise<NonNullable<Viewer>> {
  const account = await getAccount(viewer);
  if (!viewer || !account || account.role !== "admin") throw new ForbiddenError();
  return { id: account.id, role: account.role };
}

import { reply } from "@/lib/resources-api";
import { signedIn } from "@/lib/saved-api";
import { listCompletedIds } from "@/services/progress/progress";

// The ids of the signed-in user's completed files, for the Mark as done controls on public pages.
export async function GET() {
  return signedIn(null, async (viewer) => reply({ ids: await listCompletedIds(viewer) }, 200));
}

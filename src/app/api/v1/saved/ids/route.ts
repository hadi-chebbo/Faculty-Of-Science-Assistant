import { reply } from "@/lib/resources-api";
import { signedIn } from "@/lib/saved-api";
import { listSavedResourceIds } from "@/services/saved/saved";

// The ids of the signed-in user's saved resources, for the save controls on public pages.
export async function GET() {
  return signedIn(null, async (viewer) => reply({ ids: await listSavedResourceIds(viewer) }, 200));
}

import { reply } from "@/lib/resources-api";
import { signedIn } from "@/lib/saved-api";
import { listSavedResources } from "@/services/saved/saved";

// The signed-in user's saved resources grouped by course: what the Saved page shows.
export async function GET() {
  return signedIn(null, async (viewer) => reply({ courses: await listSavedResources(viewer) }, 200));
}

import { reply } from "@/lib/resources-api";
import { signedIn } from "@/lib/saved-api";
import { getProgressOverview } from "@/services/progress/progress";

// The signed-in student's progress over all their courses: the progress page, and the rings on the
// semester pages (loaded after the page shows).
export async function GET() {
  return signedIn(null, async (viewer) => reply(await getProgressOverview(viewer), 200));
}

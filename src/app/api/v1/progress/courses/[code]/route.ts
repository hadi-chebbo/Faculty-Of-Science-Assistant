import { reply } from "@/lib/resources-api";
import { signedIn } from "@/lib/saved-api";
import { getCourseProgress } from "@/services/progress/progress";

// The signed-in student's progress in one course, for the course page (loaded after the page shows).
export async function GET(_request: Request, ctx: RouteContext<"/api/v1/progress/courses/[code]">) {
  const { code } = await ctx.params;
  return signedIn(null, async (viewer) => reply(await getCourseProgress(viewer, code), 200));
}

import { reply } from "@/lib/resources-api";
import { signedIn } from "@/lib/saved-api";
import { markDone, unmarkDone } from "@/services/progress/progress";

// Mark a file as done. Marking twice is fine (`created` is then false). Answers with the progress
// the mark leads to.
export async function PUT(request: Request, ctx: RouteContext<"/api/v1/completions/[resourceId]">) {
  const { resourceId } = await ctx.params;
  return signedIn(request, async (viewer) => reply(await markDone(viewer, resourceId), 200));
}

// Mark a file as not done. Un-marking something not marked is fine.
export async function DELETE(request: Request, ctx: RouteContext<"/api/v1/completions/[resourceId]">) {
  const { resourceId } = await ctx.params;
  return signedIn(request, async (viewer) => reply(await unmarkDone(viewer, resourceId), 200));
}

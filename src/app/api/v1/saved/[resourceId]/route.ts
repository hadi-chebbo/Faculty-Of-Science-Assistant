import { reply } from "@/lib/resources-api";
import { signedIn } from "@/lib/saved-api";
import { saveResource, unsaveResource } from "@/services/saved/saved";

// Save a resource. Saving twice is fine.
export async function PUT(request: Request, ctx: RouteContext<"/api/v1/saved/[resourceId]">) {
  const { resourceId } = await ctx.params;
  return signedIn(request, async (viewer) => {
    await saveResource(viewer, resourceId);
    return reply(null, 204);
  });
}

// Remove a resource from the saved list. Removing something not saved is fine.
export async function DELETE(request: Request, ctx: RouteContext<"/api/v1/saved/[resourceId]">) {
  const { resourceId } = await ctx.params;
  return signedIn(request, async (viewer) => {
    await unsaveResource(viewer, resourceId);
    return reply(null, 204);
  });
}

import { getResourceLink } from "@/services/resources/resources";
import { redirectToResource } from "../../route-helpers";

export async function GET(request: Request, ctx: RouteContext<"/api/v1/resources/[id]/open">) {
  const { id } = await ctx.params;
  return redirectToResource(request, "open resource", (viewer) => getResourceLink(viewer, id));
}

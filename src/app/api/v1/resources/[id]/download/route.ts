import { getResourceLink } from "@/services/resources/resources";
import { redirectToResource } from "../../route-helpers";

// Same visibility and errors as the open route, but the signed URL makes the browser save the
// file under a name made from the title. Only a stored file can be downloaded.
export async function GET(request: Request, ctx: RouteContext<"/api/v1/resources/[id]/download">) {
  const { id } = await ctx.params;
  return redirectToResource(request, "download resource", (viewer) =>
    getResourceLink(viewer, id, { disposition: "attachment" }),
  );
}

import { NotFoundError, UnavailableError } from "@/services/errors";
import { getResourceLink } from "@/services/resources/resources";

// Reads the database at request time, so under cacheComponents it is never prerendered. The
// header keeps browsers and proxies from caching a redirect (a future signed URL, or the
// answer for a draft). The redirect target only ever comes from the service, never the request.
const NO_STORE = { "Cache-Control": "no-store" };

// Viewer is always null for now: there is no sign-in yet.
export async function GET(_request: Request, ctx: RouteContext<"/api/v1/resources/[id]/open">) {
  const { id } = await ctx.params;
  try {
    const { url } = await getResourceLink(null, id);
    // 307: a temporary redirect that keeps the method, as the Next.js docs use for GET handlers.
    return new Response(null, { status: 307, headers: { ...NO_STORE, Location: url } });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return Response.json({ error: "Resource not found" }, { status: 404, headers: NO_STORE });
    }
    // 503: the resource exists but its material cannot be served right now.
    if (error instanceof UnavailableError) {
      return Response.json({ error: "Resource not available yet" }, { status: 503, headers: NO_STORE });
    }
    console.error("open resource failed", error);
    return Response.json({ error: "Internal error" }, { status: 500, headers: NO_STORE });
  }
}

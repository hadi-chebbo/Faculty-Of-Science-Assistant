import { NotFoundError, UnavailableError } from "@/services/errors";
import { getResourceLink } from "@/services/resources/resources";

// Reads the database at request time, so under cacheComponents it is never prerendered. The
// header keeps browsers and proxies from caching a redirect (a future signed URL, or the
// answer for a draft). The redirect target only ever comes from the service, never the request.
const NO_STORE = { "Cache-Control": "no-store" };

// A browser that opens the link directly would otherwise show raw JSON. When the request
// accepts HTML, errors go to a fixed page instead; API clients keep the JSON.
function wantsHtml(request: Request): boolean {
  return (request.headers.get("accept") ?? "").toLowerCase().includes("text/html");
}

function failure(request: Request, status: number, error: string): Response {
  if (wantsHtml(request)) {
    // The target is a constant: nothing from the request is carried over.
    return new Response(null, { status: 307, headers: { ...NO_STORE, Location: "/resource-unavailable" } });
  }
  return Response.json({ error }, { status, headers: NO_STORE });
}

// Viewer is always null for now: there is no sign-in yet.
export async function GET(request: Request, ctx: RouteContext<"/api/v1/resources/[id]/open">) {
  const { id } = await ctx.params;
  try {
    const { url } = await getResourceLink(null, id);
    // 307: a temporary redirect that keeps the method, as the Next.js docs use for GET handlers.
    return new Response(null, { status: 307, headers: { ...NO_STORE, Location: url } });
  } catch (error) {
    if (error instanceof NotFoundError) return failure(request, 404, "Resource not found");
    // 503: the resource exists but its material cannot be served right now.
    if (error instanceof UnavailableError) return failure(request, 503, "Resource not available yet");
    console.error("open resource failed", error);
    return failure(request, 500, "Internal error");
  }
}

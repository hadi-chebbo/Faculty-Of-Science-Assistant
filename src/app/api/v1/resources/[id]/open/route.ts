import { getViewer } from "@/lib/auth/viewer";
import { getAccount } from "@/services/auth/auth";
import { NotFoundError, UnavailableError } from "@/services/errors";
import { getResourceLink } from "@/services/resources/resources";
import type { Viewer } from "@/services/viewer";

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

// The viewer for this request: anonymous unless a signed-in account still exists. The role comes
// from the database, not the token (up to 15 minutes old), as on the admin pages. Public opening
// must work without auth configured, so any failure to read the session means anonymous.
async function currentViewer(): Promise<Viewer> {
  try {
    const account = await getAccount(await getViewer());
    return account ? { id: account.id, role: account.role } : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request, ctx: RouteContext<"/api/v1/resources/[id]/open">) {
  const { id } = await ctx.params;
  try {
    const { url } = await getResourceLink(await currentViewer(), id);
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

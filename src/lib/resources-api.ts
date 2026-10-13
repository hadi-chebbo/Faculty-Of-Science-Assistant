import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { isSameOrigin, NO_STORE } from "@/lib/auth/request";
import { ForbiddenError, NotFoundError, ValidationError } from "@/services/errors";
import type { Viewer } from "@/services/viewer";

export const reply = (body: object | null, status: number) =>
  body === null
    ? new NextResponse(null, { status, headers: NO_STORE })
    : NextResponse.json(body, { status, headers: NO_STORE });

// The JSON object in the request body, or null when the body is not valid JSON or not an object.
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

// Shared by the admin write routes (resources and chapters): the same-origin check, the viewer, and
// the mapping of service errors to responses. The role check itself stays in the service. A
// not-found error is answered with its own message ("Resource not found", "Chapter not found",
// "Course not found"). A missing viewer
// (not signed in, or the token expired) is 401; a signed-in viewer without permission is 403.
export async function adminWrite(request: Request, action: (viewer: Viewer) => Promise<Response>): Promise<Response> {
  if (!isSameOrigin(request)) return reply({ error: "Forbidden" }, 403);

  let viewer: Viewer = null;
  try {
    viewer = await getViewer();
    return await action(viewer);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return viewer ? reply({ error: "Forbidden" }, 403) : reply({ error: "Not signed in" }, 401);
    }
    if (error instanceof ValidationError) return reply({ error: "Invalid input", fields: error.fields }, 400);
    if (error instanceof NotFoundError) return reply({ error: error.message }, 404);
    console.error("admin write failed", error);
    return reply({ error: "Internal error" }, 500);
  }
}

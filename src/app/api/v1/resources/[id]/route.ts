import type { NextRequest } from "next/server";
import { adminWrite, readJsonObject, reply } from "@/lib/resources-api";
import type { ResourceInput } from "@/services/resources/schemas";
import { deleteResource, updateResource } from "@/services/resources/write";

// The id comes from the URL only. The service validates the body.
export async function PUT(request: NextRequest, ctx: RouteContext<"/api/v1/resources/[id]">) {
  const { id } = await ctx.params;
  return adminWrite(request, async (viewer) => {
    const body = await readJsonObject(request);
    if (!body) return reply({ error: "Invalid request" }, 400);
    return reply({ resource: await updateResource(viewer, id, body as unknown as ResourceInput) }, 200);
  });
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/v1/resources/[id]">) {
  const { id } = await ctx.params;
  return adminWrite(request, async (viewer) => {
    await deleteResource(viewer, id);
    return reply(null, 204);
  });
}

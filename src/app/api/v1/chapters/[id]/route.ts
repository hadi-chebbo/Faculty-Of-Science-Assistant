import type { NextRequest } from "next/server";
import { adminWrite, readJsonObject, reply } from "@/lib/resources-api";
import { deleteChapter, renameChapter } from "@/services/chapters/chapters";

// The id comes from the URL only. The service validates the title.
export async function PUT(request: NextRequest, ctx: RouteContext<"/api/v1/chapters/[id]">) {
  const { id } = await ctx.params;
  return adminWrite(request, async (viewer) => {
    const body = await readJsonObject(request);
    if (!body) return reply({ error: "Invalid request" }, 400);
    return reply({ chapters: await renameChapter(viewer, id, { title: body.title as string }) }, 200);
  });
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/v1/chapters/[id]">) {
  const { id } = await ctx.params;
  return adminWrite(request, async (viewer) => {
    return reply({ chapters: await deleteChapter(viewer, id) }, 200);
  });
}

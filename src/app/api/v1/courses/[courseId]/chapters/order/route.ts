import type { NextRequest } from "next/server";
import { adminWrite, readJsonObject, reply } from "@/lib/resources-api";
import { reorderChapters } from "@/services/chapters/chapters";

// The course id comes from the URL only. The service checks that chapterIds is exactly the course's list.
export async function PUT(request: NextRequest, ctx: RouteContext<"/api/v1/courses/[courseId]/chapters/order">) {
  const { courseId } = await ctx.params;
  return adminWrite(request, async (viewer) => {
    const body = await readJsonObject(request);
    if (!body) return reply({ error: "Invalid request" }, 400);
    return reply({ chapters: await reorderChapters(viewer, courseId, body.chapterIds as string[]) }, 200);
  });
}

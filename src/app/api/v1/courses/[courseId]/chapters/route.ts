import type { NextRequest } from "next/server";
import { adminWrite, readJsonObject, reply } from "@/lib/resources-api";
import { createChapter } from "@/services/chapters/chapters";

// The course id comes from the URL only. The service validates the title.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v1/courses/[courseId]/chapters">) {
  const { courseId } = await ctx.params;
  return adminWrite(request, async (viewer) => {
    const body = await readJsonObject(request);
    if (!body) return reply({ error: "Invalid request" }, 400);
    return reply({ chapters: await createChapter(viewer, courseId, { title: body.title as string }) }, 201);
  });
}

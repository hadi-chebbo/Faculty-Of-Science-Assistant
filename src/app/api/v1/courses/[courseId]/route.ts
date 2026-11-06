import { adminWrite, readJsonObject, reply } from "@/lib/resources-api";
import { updateCourse } from "@/services/courses/admin";

type Context = { params: Promise<{ courseId: string }> };

// Admin only: changes any of code, title and semester.
export async function PATCH(request: Request, { params }: Context) {
  const { courseId } = await params;
  return adminWrite(request, async (viewer) => {
    const body = await readJsonObject(request);
    if (!body) return reply({ error: "Invalid request" }, 400);
    const changes: Record<string, unknown> = {};
    for (const key of ["code", "title", "semester"]) if (key in body) changes[key] = body[key];
    return reply({ course: await updateCourse(viewer, courseId, changes) }, 200);
  });
}

import { adminWrite, readJsonObject, reply } from "@/lib/resources-api";
import { createCourse } from "@/services/courses/admin";

// Admin only: adds a course. The service normalises the code and validates every field.
export async function POST(request: Request) {
  return adminWrite(request, async (viewer) => {
    const body = await readJsonObject(request);
    if (!body) return reply({ error: "Invalid request" }, 400);
    const course = await createCourse(viewer, {
      code: body.code as string,
      title: body.title as string,
      semester: body.semester as number,
    });
    return reply({ course }, 201);
  });
}

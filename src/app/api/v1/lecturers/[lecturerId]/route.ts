import { adminWrite, readJsonObject, reply } from "@/lib/resources-api";
import { deleteLecturer, updateLecturer } from "@/services/lecturers/admin";

type Context = { params: Promise<{ lecturerId: string }> };

// Admin only: renames the lecturer. The slug never changes.
export async function PATCH(request: Request, { params }: Context) {
  const { lecturerId } = await params;
  return adminWrite(request, async (viewer) => {
    const body = await readJsonObject(request);
    if (!body) return reply({ error: "Invalid request" }, 400);
    return reply({ lecturer: await updateLecturer(viewer, lecturerId, { name: body.name as string }) }, 200);
  });
}

// Admin only: refused (409 lecturer_in_use) while any file uses the lecturer.
export async function DELETE(request: Request, { params }: Context) {
  const { lecturerId } = await params;
  return adminWrite(request, async (viewer) => {
    await deleteLecturer(viewer, lecturerId);
    return reply(null, 204);
  });
}

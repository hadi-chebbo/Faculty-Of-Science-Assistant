import { adminWrite, readJsonObject, reply } from "@/lib/resources-api";
import { createLecturer, listAdminLecturers } from "@/services/lecturers/admin";

// Admin only: every lecturer with the number of files that use them (drafts included).
export async function GET(request: Request) {
  return adminWrite(request, async (viewer) => reply({ lecturers: await listAdminLecturers(viewer) }, 200));
}

// Admin only: adds a lecturer. The service normalises the name; the slug is made from it.
export async function POST(request: Request) {
  return adminWrite(request, async (viewer) => {
    const body = await readJsonObject(request);
    if (!body) return reply({ error: "Invalid request" }, 400);
    const lecturer = await createLecturer(viewer, { name: body.name as string });
    return reply({ lecturer }, 201);
  });
}

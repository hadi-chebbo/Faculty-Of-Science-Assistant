import type { NextRequest } from "next/server";
import { adminWrite, readJsonObject, reply } from "@/lib/resources-api";
import { createResourceUpload } from "@/services/resources/upload";

// The service validates the size; the handler only passes the parsed object on.
export async function POST(request: NextRequest) {
  return adminWrite(request, async (viewer) => {
    const body = await readJsonObject(request);
    if (!body) return reply({ error: "Invalid request" }, 400);
    return reply(await createResourceUpload(viewer, body as { size: number }), 201);
  });
}

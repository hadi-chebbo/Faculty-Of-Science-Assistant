import type { NextRequest } from "next/server";
import { adminWrite, readJsonObject, reply } from "@/lib/resources-api";
import { deleteAbandonedUploads } from "@/services/storage-cleanup/cleanup";

// The service validates the keys and re-checks every rule before deleting.
export async function POST(request: NextRequest) {
  return adminWrite(request, async (viewer) => {
    const body = await readJsonObject(request);
    if (!body) return reply({ error: "Invalid request" }, 400);
    return reply(await deleteAbandonedUploads(viewer, body.keys as string[]), 200);
  });
}

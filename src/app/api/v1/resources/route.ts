import type { NextRequest } from "next/server";
import { adminWrite, readJsonObject, reply } from "@/lib/resources-api";
import type { ResourceInput } from "@/services/resources/schemas";
import { createResource } from "@/services/resources/write";

// The service validates the input; the handler only passes the parsed object on.
export async function POST(request: NextRequest) {
  return adminWrite(request, async (viewer) => {
    const body = await readJsonObject(request);
    if (!body) return reply({ error: "Invalid request" }, 400);
    return reply({ resource: await createResource(viewer, body as unknown as ResourceInput) }, 201);
  });
}

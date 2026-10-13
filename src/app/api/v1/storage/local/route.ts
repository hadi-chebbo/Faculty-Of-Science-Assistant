import { NO_STORE } from "@/lib/auth/request";
import { getStorage, getStorageConfig } from "@/lib/storage/config";
import { verifyStorageToken } from "@/lib/storage/token";

// Stand-in for the cloud's signed URLs when STORAGE_DRIVER=local. The token is the whole
// authorisation (no cookies, no session), exactly like a real signed URL.
const respond = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers: { ...NO_STORE, ...headers } });

const isLocal = () => getStorageConfig().driver === "local";

// Quotes, slashes, control characters and line breaks are dropped so the header cannot be broken.
function safeFilename(name: string | undefined): string {
  const cleaned = (name ?? "").replace(/[\u0000-\u001f\u007f"\\/;]/g, "").trim().slice(0, 150);
  return cleaned || "file.pdf";
}

export async function PUT(request: Request) {
  if (!isLocal()) return respond(404);
  const grant = await verifyStorageToken(new URL(request.url).searchParams.get("token"), "put");
  if (!grant) return respond(403);
  if (request.headers.get("content-type") !== grant.contentType) return respond(415);

  // Count bytes while streaming; Content-Length is not trusted. Nothing is written until the
  // whole body is known to fit, so a refused upload leaves nothing on disk.
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > grant.maxBytes) {
        await reader.cancel();
        return respond(413);
      }
      chunks.push(value);
    }
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  await getStorage().put(grant.key, body, grant.contentType);
  return respond(204);
}

export async function GET(request: Request) {
  if (!isLocal()) return respond(404);
  const grant = await verifyStorageToken(new URL(request.url).searchParams.get("token"), "get");
  if (!grant) return respond(403);
  const storage = getStorage();
  const info = await storage.stat(grant.key);
  const body = info ? await storage.readStart(grant.key, info.size) : null;
  if (!info || !body) return respond(404);
  const disposition =
    grant.disposition === "inline" ? "inline" : `attachment; filename="${safeFilename(grant.filename)}"`;
  return new Response(body as BodyInit, {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": info.contentType ?? "application/octet-stream",
      "Content-Length": String(body.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": disposition,
    },
  });
}

import { UPLOAD_CONTENT_TYPE, UPLOAD_MAX_BYTES } from "@/db/constants";
import { getStorage } from "@/lib/storage/config";
import { newResourceFileKey } from "@/lib/storage/keys";
import { signUploadTicket } from "@/lib/storage/upload-ticket";
import { requireCurrentAdmin } from "../auth/require-admin";
import { ValidationError } from "../errors";
import type { Viewer } from "../viewer";

const UPLOAD_URL_LIFETIME_SECONDS = 10 * 60;

export interface ResourceUpload {
  upload: { url: string; method: "PUT"; headers: Record<string, string> };
  // Handed back when saving the resource; proves which stored object this upload is.
  ticket: string;
}

// Step one of adding a file: the browser says how big it is and gets a URL to send it to. The
// storage key is generated here and only ever leaves the server inside the signed ticket.
export async function createResourceUpload(viewer: Viewer, input: { size: number }): Promise<ResourceUpload> {
  await requireCurrentAdmin(viewer);
  const size: unknown = input?.size;
  if (typeof size !== "number" || !Number.isInteger(size) || size < 1 || size > UPLOAD_MAX_BYTES) {
    throw new ValidationError(["file"]);
  }

  const key = newResourceFileKey();
  const upload = await getStorage().createUploadUrl(key, {
    contentType: UPLOAD_CONTENT_TYPE,
    maxBytes: UPLOAD_MAX_BYTES,
    expiresInSeconds: UPLOAD_URL_LIFETIME_SECONDS,
  });
  return { upload, ticket: await signUploadTicket(key) };
}

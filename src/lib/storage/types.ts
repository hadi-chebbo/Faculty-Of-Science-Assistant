// The one place the app talks to file storage. A local-folder driver serves development and
// tests; an R2 (S3-compatible) driver serves production. Callers never know which is in use.
export interface FileStorage {
  // A URL the browser can PUT the file to, valid for a short time and for exactly this key,
  // content type and size limit. `headers` are the headers the browser must send with the PUT.
  createUploadUrl(
    key: string,
    options: { contentType: string; maxBytes: number; expiresInSeconds: number },
  ): Promise<{ url: string; method: "PUT"; headers: Record<string, string> }>;
  // Size and content type of a stored file, or null when there is none.
  stat(key: string): Promise<{ size: number; contentType: string | null } | null>;
  // The first `bytes` bytes of a stored file (fewer if it is shorter), or null when there is none.
  readStart(key: string, bytes: number): Promise<Uint8Array | null>;
  // A URL the browser can GET the file from, valid for a short time. `inline` shows it in the
  // page; `attachment` downloads it under `filename`.
  createReadUrl(
    key: string,
    options: { expiresInSeconds: number; disposition: "inline" | "attachment"; filename?: string },
  ): Promise<string>;
  // Writes a file from the server (seed data and tests).
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  // Removes a file; removing a missing file is not an error.
  delete(key: string): Promise<void>;
  // Every stored object whose key starts with `prefix` (all pages, in no particular order).
  list(prefix: string): Promise<{ key: string; size: number; lastModified: Date }[]>;
}

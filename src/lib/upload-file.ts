import { UPLOAD_CONTENT_TYPE, UPLOAD_MAX_BYTES } from "@/db/constants";
import { adminFetch } from "@/lib/admin-fetch";

export const NOT_A_PDF_MESSAGE = "Choose a PDF file.";
export const BAD_SIZE_MESSAGE = "The file must be a PDF of at most 50 MB.";
export const UPLOAD_FAILED_MESSAGE = "The upload failed. Try again.";

// Browser-side checks before any request. Returns an error message, or null when the file may be sent.
export function checkPdfFile(file: { name: string; type: string; size: number }): string | null {
  const isPdf = file.type === UPLOAD_CONTENT_TYPE || /\.pdf$/i.test(file.name);
  if (!isPdf) return NOT_A_PDF_MESSAGE;
  if (file.size < 1 || file.size > UPLOAD_MAX_BYTES) return BAD_SIZE_MESSAGE;
  return null;
}

// "2.4 MB", "310 KB", "12 bytes".
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export class UploadError extends Error {}

type UploadGrant = { upload: { url: string; method: string; headers: Record<string, string> }; ticket: string };

function isGrant(value: unknown): value is UploadGrant {
  if (typeof value !== "object" || value === null) return false;
  const { upload, ticket } = value as Partial<UploadGrant>;
  return typeof ticket === "string" && typeof upload?.url === "string" && typeof upload.headers === "object" && upload.headers !== null;
}

function sendBytes(file: Blob, upload: UploadGrant["upload"], onProgress: (percent: number) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort, { once: true });
    const done = () => signal.removeEventListener("abort", abort);

    xhr.open(upload.method, upload.url);
    for (const [name, value] of Object.entries(upload.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      done();
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new UploadError(UPLOAD_FAILED_MESSAGE));
    };
    xhr.onerror = () => {
      done();
      reject(new UploadError(UPLOAD_FAILED_MESSAGE));
    };
    xhr.onabort = () => {
      done();
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    if (signal.aborted) {
      xhr.abort();
      return;
    }
    xhr.send(file);
  });
}

// Checks the file, asks the server for an upload, sends the bytes and returns the ticket to save with
// the resource. Throws UploadError (its message is shown to the admin) or an AbortError when cancelled.
// The browser's own file name is never sent: the server generates the storage key.
export async function uploadPdf(
  file: File,
  options: { signal: AbortSignal; onProgress: (percent: number) => void; onSignedOut: () => void },
): Promise<string> {
  const problem = checkPdfFile(file);
  if (problem) throw new UploadError(problem);

  let response: Response;
  try {
    response = await adminFetch(
      "/api/v1/uploads",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ size: file.size }), signal: options.signal },
      options.onSignedOut,
    );
  } catch (error) {
    if (options.signal.aborted) throw error;
    throw new UploadError(UPLOAD_FAILED_MESSAGE);
  }
  if (response.status === 400) throw new UploadError(BAD_SIZE_MESSAGE);
  if (response.status !== 201) throw new UploadError(UPLOAD_FAILED_MESSAGE);

  const grant: unknown = await response.json().catch(() => null);
  if (!isGrant(grant)) throw new UploadError(UPLOAD_FAILED_MESSAGE);

  await sendBytes(file, grant.upload, options.onProgress, options.signal);
  options.onProgress(100);
  return grant.ticket;
}

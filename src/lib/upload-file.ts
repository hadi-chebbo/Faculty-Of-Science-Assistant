import { UPLOAD_CONTENT_TYPE, UPLOAD_MAX_BYTES } from "@/db/constants";
import { adminFetch } from "@/lib/admin-fetch";

// "50 MB": the limit as the admin reads it, from the same constant the server checks.
export const MAX_SIZE_LABEL = `${UPLOAD_MAX_BYTES / (1024 * 1024)} MB`;
export const NOT_A_PDF_MESSAGE = "Choose a PDF file.";
export const BAD_SIZE_MESSAGE = `The file must be a PDF of at most ${MAX_SIZE_LABEL}.`;
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

// The session could not be renewed; `onSignedOut` has already sent the browser to sign in.
export class SignedOutError extends Error {}

const cancelled = () => new DOMException("Upload cancelled", "AbortError");

type UploadGrant = { upload: { url: string; method: string; headers: Record<string, string> }; ticket: string };

function isGrant(value: unknown): value is UploadGrant {
  if (typeof value !== "object" || value === null) return false;
  const { upload, ticket } = value as Partial<UploadGrant>;
  return (
    typeof ticket === "string" &&
    typeof upload?.url === "string" &&
    typeof upload.method === "string" &&
    typeof upload.headers === "object" &&
    upload.headers !== null
  );
}

function sendBytes(file: Blob, upload: UploadGrant["upload"], onProgress: (percent: number) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    // Cancelled before the bytes were sent. Aborting an unsent request fires no event, and a listener
    // added to a signal that already fired never runs, so settle here.
    if (signal.aborted) {
      reject(cancelled());
      return;
    }
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
      reject(cancelled());
    };
    xhr.send(file);
  });
}

// Checks the file, asks the server for an upload, sends the bytes and returns the ticket to save with
// the resource. Throws UploadError (its message is shown to the admin), SignedOutError when the session
// has ended (the browser is already on its way to sign in), or an AbortError when cancelled.
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
  if (response.status === 401) throw new SignedOutError();
  if (response.status === 400) throw new UploadError(BAD_SIZE_MESSAGE);
  if (response.status !== 201) throw new UploadError(UPLOAD_FAILED_MESSAGE);

  const grant: unknown = await response.json().catch(() => null);
  if (!isGrant(grant)) throw new UploadError(UPLOAD_FAILED_MESSAGE);

  await sendBytes(file, grant.upload, options.onProgress, options.signal);
  options.onProgress(100);
  return grant.ticket;
}

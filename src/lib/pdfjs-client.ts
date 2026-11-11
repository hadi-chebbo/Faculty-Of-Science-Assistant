// Loads PDF.js in the browser, lazily, and points it at its worker. Shared by the reader and the
// admin's upload check, so the worker is set up in one place.
// This is the "legacy" build on purpose: the modern one calls Map.prototype.getOrInsertComputed
// (Safari 26+ only) without a polyfill, so on an iPhone with older iOS the document loads but every
// page draws blank. The legacy build carries the polyfills. Keep the worker on the same build.
export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // The worker is a separate file. `new URL(..., import.meta.url)` makes Next.js (Turbopack)
  // copy it to the build output and gives its address, both in `next dev` and `next build`;
  // PDF.js then starts it as a module worker. Set once, before the first document.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  return pdfjs;
}

// Loads PDF.js in the browser, lazily, and points it at its worker. Shared by the reader and the
// admin's upload check, so the worker is set up in one place.
export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  // The worker is a separate file. `new URL(..., import.meta.url)` makes Next.js (Turbopack)
  // copy it to the build output and gives its address, both in `next dev` and `next build`;
  // PDF.js then starts it as a module worker. Set once, before the first document.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  return pdfjs;
}

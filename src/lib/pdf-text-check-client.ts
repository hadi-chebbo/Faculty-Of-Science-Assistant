import { checkTextLayer, type TextCheck } from "./pdf-text-check";
import { loadPdfjs } from "./pdfjs-client";

// Checks a chosen PDF for text in the admin's browser. It never throws: a file PDF.js cannot read
// (damaged, encrypted) or any other failure gives null, which means "not checked". The check must
// never stop an upload, so callers start it beside the upload and wait for it only at the end.
export async function checkFileTextLayer(file: File): Promise<TextCheck | null> {
  let destroy: (() => Promise<void>) | undefined;
  try {
    const pdfjs = await loadPdfjs();
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    destroy = () => task.destroy();
    const result = await checkTextLayer(await task.promise);
    return result.pageCount >= 1 ? result : null;
  } catch (error) {
    console.warn("text check skipped", error instanceof Error ? error.name : "");
    return null;
  } finally {
    await destroy?.().catch(() => {});
  }
}

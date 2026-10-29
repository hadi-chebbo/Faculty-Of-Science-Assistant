// Finds out whether a PDF has a text layer. A scanned file is only pictures: the reader cannot search
// it and the AI assistant planned for after launch cannot read it. Used by the admin's browser at
// upload and by `scripts/check-text-layers.mjs`, so it imports types only and renders nothing.
import type { PDFDocumentProxy } from "pdfjs-dist";

// A page "has text" when it holds at least this many characters that are not white space. A scanner's
// watermark ("Scanned with CamScanner") is shorter, so it does not count.
export const MIN_TEXT_CHARS = 30;

export interface TextCheck {
  pageCount: number;
  textPageCount: number;
}

export type TextLayerStatus = "scanned" | "partial" | "text" | "unchecked";

// Does a page whose text items are `strings` have text?
export function pageHasText(strings: readonly string[]): boolean {
  let count = 0;
  for (const text of strings) {
    for (const char of text) {
      if (!/\s/.test(char) && ++count >= MIN_TEXT_CHARS) return true;
    }
  }
  return false;
}

// Derived from the two stored numbers; never stored. Null means the file was not checked.
export function textLayerStatus(pageCount: number | null, textPageCount: number | null): TextLayerStatus {
  if (pageCount === null || textPageCount === null) return "unchecked";
  if (textPageCount === 0) return "scanned";
  return textPageCount < pageCount ? "partial" : "text";
}

// "Scanned: no text found in 12 pages" / "Partly scanned: 10 of 14 pages have text" / "Text: 14 of 14 pages".
export function describeTextCheck(pageCount: number, textPageCount: number): string {
  const status = textLayerStatus(pageCount, textPageCount);
  const pages = (n: number) => `${n} ${n === 1 ? "page" : "pages"}`;
  if (status === "scanned") return `Scanned: no text found in ${pages(pageCount)}`;
  if (status === "partial") return `Partly scanned: ${textPageCount} of ${pages(pageCount)} have text`;
  return `Text: ${textPageCount} of ${pages(pageCount)}`;
}

// Reads the text of every page, one at a time, and releases each page afterwards. Throws when the
// document cannot be read; callers treat that as "not checked".
export async function checkTextLayer(pdf: PDFDocumentProxy): Promise<TextCheck> {
  let textPageCount = 0;
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    try {
      const content = await page.getTextContent();
      const strings = content.items.map((item) => ("str" in item ? item.str : ""));
      if (pageHasText(strings)) textPageCount++;
    } finally {
      page.cleanup();
    }
  }
  return { pageCount: pdf.numPages, textPageCount };
}

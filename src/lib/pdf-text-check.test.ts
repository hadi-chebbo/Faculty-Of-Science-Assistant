import { describe, expect, it } from "vitest";
// The legacy build is the one that runs in Node.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { samplePdf, scannedPdf } from "./storage/sample-pdf";
import { MIN_TEXT_CHARS, checkTextLayer, describeTextCheck, pageHasText, textLayerStatus } from "./pdf-text-check";

describe("pageHasText", () => {
  it("counts characters that are not white space", () => {
    expect(pageHasText(["x".repeat(MIN_TEXT_CHARS)])).toBe(true);
    expect(pageHasText(["x".repeat(MIN_TEXT_CHARS - 1)])).toBe(false);
  });

  it("adds up several items and ignores spaces, tabs and new lines", () => {
    expect(pageHasText(["a b c d e\n", "f\tg h i j", " k l m n o ", "p q r s t", "u v w x y z", " 1 2 3 4 5 "])).toBe(true);
    expect(pageHasText(["   ", "\n\n", "\t"])).toBe(false);
    expect(pageHasText([])).toBe(false);
  });

  it("does not count a scanner watermark", () => {
    expect(pageHasText(["Scanned with CamScanner"])).toBe(false);
  });
});

describe("textLayerStatus", () => {
  it("is derived from the two numbers", () => {
    expect(textLayerStatus(12, 0)).toBe("scanned");
    expect(textLayerStatus(14, 10)).toBe("partial");
    expect(textLayerStatus(14, 14)).toBe("text");
    expect(textLayerStatus(null, null)).toBe("unchecked");
    expect(textLayerStatus(5, null)).toBe("unchecked");
  });

  it("describes the result for the admin", () => {
    expect(describeTextCheck(12, 0)).toBe("Scanned: no text found in 12 pages");
    expect(describeTextCheck(14, 10)).toBe("Partly scanned: 10 of 14 pages have text");
    expect(describeTextCheck(14, 14)).toBe("Text: 14 of 14 pages");
    expect(describeTextCheck(1, 0)).toBe("Scanned: no text found in 1 page");
  });
});

async function check(bytes: Uint8Array) {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  try {
    // The legacy build's document proxy is the same shape as the browser's.
    return await checkTextLayer(await task.promise as never);
  } finally {
    await task.destroy();
  }
}

describe("checkTextLayer (PDF.js in Node)", () => {
  it("finds text on every page of a digital PDF", async () => {
    expect(await check(samplePdf(["Heading of the sample", "Body line with a few more words in it."], 3))).toEqual({ pageCount: 3, textPageCount: 3 });
  });

  it("finds none on an image-only PDF", async () => {
    expect(await check(scannedPdf(4))).toEqual({ pageCount: 4, textPageCount: 0 });
  });

  it("finds some on a partly scanned PDF", async () => {
    expect(await check(scannedPdf(3, [2]))).toEqual({ pageCount: 3, textPageCount: 1 });
  });
});

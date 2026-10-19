import { describe, expect, it } from "vitest";
import { looksLikePdf } from "./pdf";
import { samplePdf } from "./sample-pdf";

const text = (lines: string[]) => new TextDecoder().decode(samplePdf(lines));

describe("samplePdf", () => {
  it("is a PDF 1.4 file that ends with %%EOF", () => {
    const bytes = samplePdf(["SAMPLE FILE"]);
    expect(looksLikePdf(bytes)).toBe(true);
    const s = new TextDecoder().decode(bytes);
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("has an xref table whose offsets point at each object, and a correct startxref", () => {
    const s = text(["SAMPLE FILE", "Title"]);
    const startxref = Number(/startxref\n(\d+)\n/.exec(s)![1]);
    expect(s.slice(startxref, startxref + 4)).toBe("xref");
    const entries = [...s.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(5);
    entries.forEach((offset, i) => {
      expect(s.slice(offset).startsWith(`${i + 1} 0 obj\n`)).toBe(true);
    });
    expect(s).toContain("xref\n0 6\n");
    expect(s).toContain("/Size 6");
  });

  it("declares the right stream length", () => {
    const s = text(["SAMPLE FILE", "Title"]);
    const length = Number(/\/Length (\d+)/.exec(s)![1]);
    const stream = /stream\n([\s\S]*)\nendstream/.exec(s)![1];
    expect(stream.length).toBe(length);
  });

  it("contains the text lines", () => {
    const s = text(["SAMPLE FILE", "Sample lecture 1", "DEMO301 - Sample Course A"]);
    expect(s).toContain("(SAMPLE FILE) Tj");
    expect(s).toContain("(Sample lecture 1) Tj");
    expect(s).toContain("(DEMO301 - Sample Course A) Tj");
  });

  it("escapes parentheses and backslashes and replaces non-ASCII", () => {
    const s = text(["a (b) c\\d", "café"]);
    expect(s).toContain("(a \\(b\\) c\\\\d) Tj");
    expect(s).toContain("(caf?) Tj");
  });
});

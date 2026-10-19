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

  it("makes a file of several pages with a consistent xref table", () => {
    const s = text(["SAMPLE FILE", "Title"]);
    expect(s).toContain("/Count 1");
    const many = new TextDecoder().decode(samplePdf(["SAMPLE FILE", "Title"], 4));
    expect(many).toContain("/Count 4");
    expect(many.match(/\/Type \/Page /g)).toHaveLength(4);
    expect(many).toContain("(SAMPLE FILE - page 1) Tj");
    expect(many).toContain("(SAMPLE FILE - page 4) Tj");
    const startxref = Number(/startxref\n(\d+)\n/.exec(many)![1]);
    const entries = [...many.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(3 + 2 * 4);
    entries.forEach((offset, i) => {
      expect(many.slice(offset).startsWith(`${i + 1} 0 obj\n`)).toBe(true);
    });
    expect(many).toContain(`/Size ${entries.length + 1}`);
  });
  it("keeps the output of the plain call identical when no option is given", () => {
    const plain = new TextDecoder().decode(samplePdf(["SAMPLE FILE", "Title"], 2));
    expect(plain).not.toContain("/Outlines");
    expect(plain).not.toContain("WinAnsiEncoding");
    expect(new TextDecoder().decode(samplePdf(["SAMPLE FILE", "Title"], 2, {}))).toBe(plain);
  });

  it("writes extra lines on the pages asked for, and only there", () => {
    const s = new TextDecoder().decode(samplePdf(["SAMPLE FILE", "Title"], 3, { pageLines: { 2: ["alpha word", "beta word"] } }));
    expect(s.match(/\(alpha word\) Tj/g)).toHaveLength(1);
    const pageTwo = s.slice(s.indexOf("(SAMPLE FILE - page 2)"), s.indexOf("(SAMPLE FILE - page 3)"));
    expect(pageTwo).toContain("(alpha word) Tj");
    expect(pageTwo).toContain("(beta word) Tj");
  });

  it("writes Latin-1 letters as octal escapes with WinAnsi encoding", () => {
    const s = new TextDecoder().decode(samplePdf(["SAMPLE FILE", "Title"], 1, { pageLines: { 1: ["\u00e9t\u00e9"] } }));
    expect(s).toContain("/Encoding /WinAnsiEncoding");
    expect(s).toContain("(\\351t\\351) Tj");
    // Still plain ASCII, so the xref offsets stay right.
    expect(/^[\x00-\x7f]*$/.test(s)).toBe(true);
  });

  it("writes a nested outline whose entries point at the right pages", () => {
    const bytes = samplePdf(["SAMPLE FILE", "Title"], 4, {
      outline: [
        { title: "One", page: 1 },
        { title: "Two", page: 2, children: [{ title: "Two A", page: 3 }, { title: "Two B", page: 4 }] },
      ],
    });
    const s = new TextDecoder().decode(bytes);
    // Pages are objects 4, 6, 8 and 10; the outline root is object 12, then its four entries.
    expect(s).toContain("/Outlines 12 0 R");
    expect(s).toContain("12 0 obj\n<< /Type /Outlines /First 13 0 R /Last 14 0 R /Count 4 >>");
    expect(s).toContain("13 0 obj\n<< /Title (One) /Parent 12 0 R /Next 14 0 R /Dest [4 0 R /Fit] >>");
    expect(s).toContain("14 0 obj\n<< /Title (Two) /Parent 12 0 R /Prev 13 0 R /First 15 0 R /Last 16 0 R /Count 2 /Dest [6 0 R /Fit] >>");
    expect(s).toContain("15 0 obj\n<< /Title (Two A) /Parent 14 0 R /Next 16 0 R /Dest [8 0 R /Fit] >>");
    expect(s).toContain("16 0 obj\n<< /Title (Two B) /Parent 14 0 R /Prev 15 0 R /Dest [10 0 R /Fit] >>");
    const startxref = Number(/startxref\n(\d+)\n/.exec(s)![1]);
    const entries = [...s.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(16);
    entries.forEach((offset, i) => {
      expect(s.slice(offset).startsWith(`${i + 1} 0 obj\n`)).toBe(true);
    });
  });
});

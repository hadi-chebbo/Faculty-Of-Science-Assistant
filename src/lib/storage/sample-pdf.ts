// A tiny PDF writer for the demo seed data: A4 pages of Helvetica text. Only ASCII is
// supported; anything else becomes "?". No dependency, so the seeder can load it directly.
function escapePdfText(line: string): string {
  return line.replace(/[^\x20-\x7e]/g, "?").replace(/[\\()]/g, (c) => `\\${c}`);
}

// `pages` makes a file of that many pages with the same text; with more than one, the heading of
// each page ends with " - page N" so the pages can be told apart.
export function samplePdf(lines: string[], pages = 1): Uint8Array {
  // The first line is a heading; the rest are smaller body lines below it.
  const contentOf = (page: number) =>
    [
      "BT",
      "/F1 24 Tf",
      "72 760 Td",
      "30 TL",
      ...lines.map((line, i) => {
        const text = i === 0 && pages > 1 ? `${line} - page ${page}` : line;
        return `${i === 1 ? "/F1 14 Tf\n" : ""}(${escapePdfText(text)}) Tj T*`;
      }),
      "ET",
    ].join("\n");

  // Object 1 is the catalog, 2 the page tree and 3 the font; each page then takes two objects
  // (the page, then its content).
  const pageIds = Array.from({ length: pages }, (_, i) => 4 + 2 * i);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...pageIds.flatMap((id, i) => {
      const content = contentOf(i + 1);
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`,
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      ];
    }),
  ];

  // Everything is ASCII, so string length equals byte length and offsets can be computed on text.
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

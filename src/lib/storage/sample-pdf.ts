// A tiny PDF writer for the demo seed data: one A4 page of Helvetica text. Only ASCII is
// supported; anything else becomes "?". No dependency, so the seeder can load it directly.
function escapePdfText(line: string): string {
  return line.replace(/[^\x20-\x7e]/g, "?").replace(/[\\()]/g, (c) => `\\${c}`);
}

export function samplePdf(lines: string[]): Uint8Array {
  // The first line is a heading; the rest are smaller body lines below it.
  const content = [
    "BT",
    "/F1 24 Tf",
    "72 760 Td",
    "30 TL",
    ...lines.map((line, i) => `${i === 1 ? "/F1 14 Tf\n" : ""}(${escapePdfText(line)}) Tj T*`),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
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

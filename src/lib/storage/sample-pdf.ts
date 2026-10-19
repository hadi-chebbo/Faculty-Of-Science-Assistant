// A tiny PDF writer for the demo seed data: A4 pages of Helvetica text. Only ASCII is
// supported by default; anything else becomes "?". No dependency, so the seeder can load it directly.
// Tests that need accented letters turn on Latin-1 text (see `SamplePdfOptions.latin1`).
function escapePdfText(line: string, latin1: boolean): string {
  const unsupported = latin1 ? /[^\x20-\x7e\xa0-\xff]/g : /[^\x20-\x7e]/g;
  return line
    .replace(unsupported, "?")
    .replace(/[\\()]/g, (c) => `\\${c}`)
    .replace(/[\x80-\xff]/g, (c) => `\\${c.charCodeAt(0).toString(8)}`);
}

export interface OutlineItem {
  title: string;
  // 1-based page the entry points at.
  page: number;
  children?: OutlineItem[];
}

export interface SamplePdfOptions {
  // Extra body lines by page number (1-based), written under the normal text of that page.
  pageLines?: Record<number, string[]>;
  // A table of contents (the PDF's Outlines), nested through `children`.
  outline?: OutlineItem[];
  // Allow Latin-1 letters such as "é" in the text (the font then uses WinAnsi encoding). Also turned
  // on by any non-ASCII character in `pageLines`.
  latin1?: boolean;
}

// An outline entry with the object numbers that link it to its neighbours.
interface OutlineObject {
  id: number;
  item: OutlineItem;
  parent: number;
  prev?: number;
  next?: number;
  first?: number;
  last?: number;
  count: number;
}

// `pages` makes a file of that many pages with the same text; with more than one, the heading of
// each page ends with " - page N" so the pages can be told apart.
export function samplePdf(lines: string[], pages = 1, options: SamplePdfOptions = {}): Uint8Array {
  const { pageLines = {}, outline = [] } = options;
  const latin1 = options.latin1 ?? Object.values(pageLines).some((extra) => extra.some((line) => /[^\x00-\x7f]/.test(line)));
  // The first line is a heading; the rest are smaller body lines below it.
  const contentOf = (page: number) =>
    [
      "BT",
      "/F1 24 Tf",
      "72 760 Td",
      "30 TL",
      ...lines.map((line, i) => {
        const text = i === 0 && pages > 1 ? `${line} - page ${page}` : line;
        return `${i === 1 ? "/F1 14 Tf\n" : ""}(${escapePdfText(text, latin1)}) Tj T*`;
      }),
      ...(pageLines[page] ?? []).map((line) => `(${escapePdfText(line, latin1)}) Tj T*`),
      "ET",
    ].join("\n");

  // Object 1 is the catalog, 2 the page tree and 3 the font; each page then takes two objects
  // (the page, then its content); the outline objects, if any, come last.
  const pageIds = Array.from({ length: pages }, (_, i) => 4 + 2 * i);
  const outlineRoot = 4 + 2 * pages;

  const entries: OutlineObject[] = [];
  const addEntries = (items: OutlineItem[], parent: number): number[] => {
    const created = items.map((item) => {
      const entry: OutlineObject = { id: outlineRoot + 1 + entries.length, item, parent, count: 0 };
      entries.push(entry);
      const children = addEntries(item.children ?? [], entry.id);
      if (children.length) {
        entry.first = children[0];
        entry.last = children[children.length - 1];
        entry.count = children.length;
      }
      return entry;
    });
    created.forEach((entry, i) => {
      entry.prev = created[i - 1]?.id;
      entry.next = created[i + 1]?.id;
    });
    return created.map((entry) => entry.id);
  };
  const top = addEntries(outline, outlineRoot);

  const objects = [
    `<< /Type /Catalog /Pages 2 0 R${top.length ? ` /Outlines ${outlineRoot} 0 R` : ""} >>`,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages} >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica${latin1 ? " /Encoding /WinAnsiEncoding" : ""} >>`,
    ...pageIds.flatMap((id, i) => {
      const content = contentOf(i + 1);
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`,
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      ];
    }),
    ...(top.length
      ? [
          `<< /Type /Outlines /First ${top[0]} 0 R /Last ${top[top.length - 1]} 0 R /Count ${entries.length} >>`,
          ...entries.map((e) => {
            const page = pageIds[Math.min(Math.max(e.item.page, 1), pages) - 1];
            return [
              `<< /Title (${escapePdfText(e.item.title, latin1)}) /Parent ${e.parent} 0 R`,
              e.prev ? ` /Prev ${e.prev} 0 R` : "",
              e.next ? ` /Next ${e.next} 0 R` : "",
              e.first ? ` /First ${e.first} 0 R /Last ${e.last} 0 R /Count ${e.count}` : "",
              ` /Dest [${page} 0 R /Fit] >>`,
            ].join("");
          }),
        ]
      : []),
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

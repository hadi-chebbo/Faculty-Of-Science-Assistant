// The PDF's table of contents, turned into entries that know their page. Free of React and the DOM
// so it can be tested; the PDF document is passed in through a small interface.

export interface RawOutlineItem {
  title: string;
  // A named destination, an explicit destination ([pageRef, "XYZ", ...]) or nothing (a web link).
  dest?: string | readonly unknown[] | null;
  items?: readonly RawOutlineItem[];
}

// How a PDF names one of its pages in a destination (PDF.js's RefProxy).
export interface PageRef {
  num: number;
  gen: number;
}

export interface OutlineSource {
  getOutline(): Promise<readonly RawOutlineItem[] | null>;
  getDestination(id: string): Promise<readonly unknown[] | null>;
  getPageIndex(ref: PageRef): Promise<number>;
}

export interface OutlineNode {
  title: string;
  // 1-based; null when the entry does not lead to a page of this file.
  page: number | null;
  children: OutlineNode[];
}

// A table of contents longer than this is cut: it is a list to skim, and every entry is a button.
const MAX_ENTRIES = 1000;

async function pageOf(source: OutlineSource, dest: RawOutlineItem["dest"], total: number): Promise<number | null> {
  try {
    const explicit = typeof dest === "string" ? await source.getDestination(dest) : dest;
    if (!explicit || explicit.length === 0) return null;
    const target = explicit[0];
    // A reference to the page object, or (rarely) the page's index itself.
    const index = typeof target === "number" ? target : await source.getPageIndex(target as PageRef);
    return Number.isInteger(index) && index >= 0 && index < total ? index + 1 : null;
  } catch {
    return null;
  }
}

// The outline with every entry's page worked out. Entries without a page are kept (their children
// may have one) but are not links. Empty when the file has no outline.
export async function resolveOutline(source: OutlineSource, total: number): Promise<OutlineNode[]> {
  const raw = await source.getOutline().catch(() => null);
  if (!raw || raw.length === 0) return [];
  let budget = MAX_ENTRIES;
  const resolve = async (items: readonly RawOutlineItem[]): Promise<OutlineNode[]> => {
    const kept = items.slice(0, Math.max(0, budget));
    budget -= kept.length;
    return Promise.all(
      kept.map(async (item) => ({
        title: item.title.replace(/\s+/g, " ").trim() || "Untitled",
        page: await pageOf(source, item.dest, total),
        children: await resolve(item.items ?? []),
      })),
    );
  };
  return resolve(raw);
}

// Whether the outline can be used at all: at least one entry leads to a page.
export function hasLinks(nodes: readonly OutlineNode[]): boolean {
  return nodes.some((node) => node.page !== null || hasLinks(node.children));
}

export interface OutlineRow {
  node: OutlineNode;
  depth: number;
  // Position in reading order, usable as a key.
  id: number;
}

export function flattenOutline(nodes: readonly OutlineNode[], depth = 0, out: OutlineRow[] = []): OutlineRow[] {
  for (const node of nodes) {
    out.push({ node, depth, id: out.length });
    flattenOutline(node.children, depth + 1, out);
  }
  return out;
}

// The entry that contains the page being read: the one whose page is the latest at or before it
// (the later and deeper one when several share a page). Null before the first entry.
export function activeRowId(rows: readonly OutlineRow[], current: number): number | null {
  let best: OutlineRow | null = null;
  for (const row of rows) {
    const page = row.node.page;
    if (page === null || page > current) continue;
    if (!best || page >= best.node.page!) best = row;
  }
  return best?.id ?? null;
}

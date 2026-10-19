import type { PageMatch } from "./reader-search";

// Marks search matches on a page's text layer: the characters of a match are wrapped in <mark>
// elements (soft yellow; the current match also gets the `reader-hit-current` class). The text layer
// has one element per PDF text item, in the same order as the items the search ran over. Returns the
// way back, which puts the original text in place again.
export function applyHighlights(
  elements: readonly HTMLElement[],
  strings: readonly string[],
  matches: readonly PageMatch[],
  current: number | null,
): () => void {
  const byItem = new Map<number, { start: number; end: number; current: boolean }[]>();
  matches.forEach((match, index) => {
    for (const part of match) {
      const list = byItem.get(part.item) ?? [];
      list.push({ start: part.start, end: part.end, current: index === current });
      byItem.set(part.item, list);
    }
  });

  const touched: [HTMLElement, string][] = [];
  for (const [item, parts] of byItem) {
    const element = elements[item];
    const text = strings[item];
    // The element must still hold exactly the text the search ran over.
    if (!element || text === undefined || element.textContent !== text) continue;
    parts.sort((a, b) => a.start - b.start);
    const nodes: Node[] = [];
    let at = 0;
    for (const part of parts) {
      if (part.start > at) nodes.push(document.createTextNode(text.slice(at, part.start)));
      const mark = document.createElement("mark");
      mark.className = part.current ? "reader-hit reader-hit-current" : "reader-hit";
      mark.textContent = text.slice(part.start, part.end);
      nodes.push(mark);
      at = part.end;
    }
    if (at < text.length) nodes.push(document.createTextNode(text.slice(at)));
    element.replaceChildren(...nodes);
    touched.push([element, text]);
  }

  return () => {
    for (const [element, text] of touched) element.textContent = text;
  };
}

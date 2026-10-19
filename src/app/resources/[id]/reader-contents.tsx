"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { activeRowId, flattenOutline, hasLinks, resolveOutline, type OutlineNode } from "./reader-outline";
import { ThumbnailButton } from "./reader-thumbnail";

// The PDF's outline, read the first time it is wanted. Null while it is being read.
export function useOutline(pdf: PDFDocumentProxy, wanted: boolean): OutlineNode[] | null {
  const [outline, setOutline] = useState<OutlineNode[] | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (!wanted || started.current) return;
    started.current = true;
    resolveOutline(pdf, pdf.numPages).then(setOutline, () => setOutline([]));
  }, [pdf, wanted]);
  return outline;
}

// What the Contents panel and sheet show: the file's own table of contents, or, when it has none,
// a thumbnail of every page. The entry for the page being read is marked; choosing one goes to it.
export function ReaderContents({
  pdf,
  sizes,
  outline,
  current,
  onSelect,
}: {
  pdf: PDFDocumentProxy;
  sizes: { width: number; height: number }[];
  outline: OutlineNode[] | null;
  current: number;
  onSelect: (page: number) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const rows = useMemo(() => flattenOutline(outline ?? []), [outline]);
  const useOutlineRows = outline !== null && hasLinks(outline);
  const active = useOutlineRows ? activeRowId(rows, current) : current;

  // Keep the marked entry in sight inside the list (only the list scrolls, never the page).
  useEffect(() => {
    const nav = navRef.current;
    const marked = nav?.querySelector<HTMLElement>("[aria-current]");
    if (!nav || !marked) return;
    const list = nav.getBoundingClientRect();
    const item = marked.getBoundingClientRect();
    if (item.top < list.top) nav.scrollTop -= list.top - item.top + 8;
    else if (item.bottom > list.bottom) nav.scrollTop += item.bottom - list.bottom + 8;
  }, [active, useOutlineRows]);

  return (
    <nav ref={navRef} aria-label="Contents" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
      {outline === null ? (
        <p className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</p>
      ) : useOutlineRows ? (
        <ul className="flex flex-col gap-px text-sm">
          {rows.map(({ node, depth, id }) => (
            <li key={id}>
              {node.page === null ? (
                <span className="block px-2 py-1.5 text-muted-foreground" style={{ paddingLeft: 8 + depth * 12 }}>
                  {node.title}
                </span>
              ) : (
                <button
                  type="button"
                  aria-current={id === active ? "location" : undefined}
                  onClick={() => onSelect(node.page!)}
                  className={cn(
                    "flex min-h-10 w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-foreground outline-none md:min-h-8",
                    "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                    id === active && "bg-accent font-semibold text-primary",
                  )}
                  style={{ paddingLeft: 8 + depth * 12 }}
                >
                  <span className="min-w-0 flex-1 break-words">{node.title}</span>
                  <span className={cn("shrink-0 tabular-nums", id !== active && "text-muted-foreground")}>{node.page}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col items-center gap-1">
          {sizes.map((size, i) => (
            <li key={i}>
              <ThumbnailButton pdf={pdf} number={i + 1} size={size} active={i + 1 === current} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

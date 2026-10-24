"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { PageHits } from "./page-canvas";
import { PAGE_GAP_ABOVE } from "./reader-zoom";
import { useDocumentSearch } from "./use-document-search";

// Typing pauses this long before the search runs.
const DEBOUNCE_MS = 250;
// A search match is looked for on its page for this many animation frames (the page's text layer
// may still be on its way) before the reader gives up on centring it.
const REVEAL_FRAMES = 180;
// While a match is being taken into view, the pages passing by do not change the current page.
const REVEAL_HOLD_MS = 1000;
const REVEAL_SETTLE_MS = 150;

// What the search needs from the reader around it.
export interface SearchHost {
  // The element that scrolls the pages.
  area: () => HTMLElement | null;
  // The part of the screen the pages are seen through.
  viewport: () => { top: number; bottom: number };
  // Scrolls the pages (the area or the window, whichever scrolls them) by `delta` pixels at once.
  scrollBy: (delta: number) => void;
  currentPage: () => number;
  // The reader is being taken to `page` by something other than a page change of its own.
  beginJump: (page: number, holdMs: number) => void;
  // Look at what is really in view once the scroll is over.
  settle: (afterMs: number) => void;
}

// The search of the reader: whether it is open, the text typed (and the debounced term that is
// searched), the result, the current match, and taking the reader to a match. Kept out of the card
// so the card's other state stays readable.
// `input` and `button` are the search box and the button that opens it (the focus goes there).
export function useReaderSearch(
  pdf: PDFDocumentProxy,
  host: SearchHost,
  input: RefObject<HTMLInputElement | null>,
  button: RefObject<HTMLButtonElement | null>,
) {
  const [open, setOpen] = useState(false);
  const [query, setQueryState] = useState("");
  const [term, setTerm] = useState("");
  const [focusRequest, setFocusRequest] = useState(0);
  const hostRef = useRef(host);
  useEffect(() => {
    hostRef.current = host;
  });

  const { status, step } = useDocumentSearch(pdf, open ? term : "", () => hostRef.current.currentPage());

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setTerm(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, open]);
  useEffect(() => {
    if (focusRequest === 0) return;
    input.current?.focus();
    input.current?.select();
  }, [focusRequest, input]);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    if (!value.trim()) setTerm("");
  }, []);
  // Opens it, or when it is open already, puts the cursor back in its box.
  const openSearch = useCallback(() => {
    setOpen(true);
    setFocusRequest((n) => n + 1);
  }, []);
  // Every way of closing it brings the focus back to the Search button.
  const close = useCallback(() => {
    setOpen(false);
    setQueryState("");
    setTerm("");
    button.current?.focus({ preventScroll: true });
  }, [button]);
  // Search now, without waiting for typing to pause.
  const flush = useCallback(() => setTerm(query), [query]);

  // Taking the reader to a match: the match's page first, then the match itself near the middle of
  // the reading area once the page's text layer has marked it.
  const frame = useRef(0);
  const reveal = useCallback((page: number) => {
    const h = hostRef.current;
    const area = h.area();
    if (!area) return;
    cancelAnimationFrame(frame.current);
    let frames = 0;
    let cancelled = false;
    const stop = () => {
      cancelled = true;
      area.removeEventListener("wheel", stop);
      area.removeEventListener("touchstart", stop);
    };
    // The reader taking over with the wheel or a finger wins.
    area.addEventListener("wheel", stop, { passive: true });
    area.addEventListener("touchstart", stop, { passive: true });
    h.beginJump(page, REVEAL_HOLD_MS);

    const pageElement = area.querySelector<HTMLElement>(`[data-page="${page}"]`);
    if (pageElement) h.scrollBy(pageElement.getBoundingClientRect().top - h.viewport().top - PAGE_GAP_ABOVE);

    const attempt = () => {
      if (cancelled) return;
      const mark = area.querySelector<HTMLElement>(`[data-page="${page}"] mark.reader-hit-current`);
      if (mark) {
        const box = mark.getBoundingClientRect();
        const view = h.viewport();
        h.scrollBy(box.top + box.height / 2 - (view.top + view.bottom) / 2);
        if (area.scrollWidth > area.clientWidth + 1) {
          const areaBox = area.getBoundingClientRect();
          area.scrollLeft += box.left + box.width / 2 - (areaBox.left + areaBox.width / 2);
        }
        stop();
        h.beginJump(page, 100);
        h.settle(REVEAL_SETTLE_MS);
      } else if (++frames < REVEAL_FRAMES) {
        frame.current = requestAnimationFrame(attempt);
      } else {
        stop();
        h.settle(50);
      }
    };
    frame.current = requestAnimationFrame(attempt);
  }, []);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // A new search result, or a step to another match.
  useEffect(() => {
    if (!open || status.kind !== "done") return;
    const match = status.result.flat[status.current];
    if (match) reveal(match.page);
  }, [open, status, reveal]);

  // The matches of every page, as the page wants them: nothing while the search is closed or still
  // running, so the pages are not touched by its progress.
  const hits = useMemo(() => {
    const byPage = new Map<number, PageHits>();
    if (!open || status.kind !== "done") return byPage;
    const match = status.result.flat[status.current];
    for (const [page, matches] of status.result.byPage) {
      byPage.set(page, { matches, current: match?.page === page ? match.index : null });
    }
    return byPage;
  }, [open, status]);

  return { open, query, setQuery, status, step, openSearch, close, flush, pending: query !== term, hits };
}

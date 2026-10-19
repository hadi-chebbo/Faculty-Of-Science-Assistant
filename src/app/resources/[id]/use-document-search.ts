"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  EMPTY_PAGE_TEXT,
  buildResult,
  findInText,
  firstMatchFrom,
  foldQuery,
  prepareText,
  stepMatch,
  type PageMatch,
  type PageText,
  type SearchResult,
} from "./reader-search";

export type SearchStatus =
  | { kind: "idle" }
  // percent of the pages read so far
  | { kind: "searching"; percent: number }
  | { kind: "done"; result: SearchResult; current: number };

// Searching a long file reads every page's text; the work is cut into pieces this long so that
// scrolling and typing stay responsive.
const SLICE_MS = 12;
// Progress is shown at most this often.
const PROGRESS_MS = 100;
const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// Searches the whole document for `term` (already debounced by the caller). A page's text is read
// and folded the first time a search needs it and kept, so later searches only look for the new
// query in it. `currentPage` says where the reader is: a new search starts at the first match from
// there.
export function useDocumentSearch(pdf: PDFDocumentProxy, term: string, currentPage: () => number) {
  const texts = useRef(new Map<number, Promise<PageText>>());
  // The latest progress or result, with the term it belongs to.
  const [stored, setStored] = useState<{ term: string; status: SearchStatus }>({ term: "", status: { kind: "idle" } });
  const currentPageRef = useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  });

  useEffect(() => {
    const needle = foldQuery(term);
    if (!needle) return;
    let cancelled = false;
    const report = (status: SearchStatus) => setStored({ term, status });

    const textOf = (number: number) => {
      let cached = texts.current.get(number);
      if (!cached) {
        const loading: Promise<PageText> = pdf
          .getPage(number)
          .then((page) => page.getTextContent())
          .then((content) => prepareText(content.items.flatMap((item) => ("str" in item ? [{ str: item.str, hasEOL: item.hasEOL }] : []))))
          // A page whose text cannot be read has nothing to find now, and is not remembered as
          // empty: the next search tries it again.
          .catch(() => {
            if (texts.current.get(number) === loading) texts.current.delete(number);
            return EMPTY_PAGE_TEXT;
          });
        texts.current.set(number, loading);
        cached = loading;
      }
      return cached;
    };

    (async () => {
      const perPage = new Map<number, PageMatch[]>();
      let sliceStart = performance.now();
      let lastReport = 0;
      for (let number = 1; number <= pdf.numPages; number++) {
        const text = await textOf(number);
        if (cancelled) return;
        perPage.set(number, findInText(text, needle));
        const now = performance.now();
        if (now - sliceStart > SLICE_MS) {
          if (now - lastReport >= PROGRESS_MS) {
            lastReport = now;
            report({ kind: "searching", percent: Math.round((number / pdf.numPages) * 100) });
          }
          await yieldToBrowser();
          if (cancelled) return;
          sliceStart = performance.now();
        }
      }
      const result = buildResult(term, perPage);
      report({ kind: "done", result, current: firstMatchFrom(result, currentPageRef.current()) });
    })();

    return () => {
      cancelled = true;
    };
  }, [pdf, term]);

  const step = useCallback((direction: 1 | -1) => {
    setStored((previous) =>
      previous.status.kind === "done" && previous.status.result.flat.length > 0
        ? {
            ...previous,
            status: { ...previous.status, current: stepMatch(previous.status.current, previous.status.result.flat.length, direction) },
          }
        : previous,
    );
  }, []);

  // Nothing to search for is idle; a term whose result has not arrived yet is just starting.
  const status: SearchStatus = !foldQuery(term)
    ? { kind: "idle" }
    : stored.term === term
      ? stored.status
      : { kind: "searching", percent: 0 };
  return { status, step };
}

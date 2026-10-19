"use client";

import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PageCanvas } from "./page-canvas";
import { ReaderMenu } from "./reader-menu";
import { pageToOffer, readLastPage, writeLastPage } from "./reader-position";
import {
  clampPage,
  fitPagePercent,
  fitWidthPercent,
  pageCssSize,
  parsePageInput,
  stepZoom,
  type ZoomMode,
} from "./reader-zoom";

export interface PageSize {
  // In PDF points.
  width: number;
  height: number;
}

const RESIZE_DEBOUNCE_MS = 150;
const SAVE_DEBOUNCE_MS = 500;
// Space around the pages inside the reading area (Tailwind p-4), on each side.
const PADDING = 16;
// On a phone the window scrolls: the site header, the document's top row and the tab bar take this much.
const PHONE_CHROME = 56 + 52 + 56;
const PHONE_TAB_BAR = 56;
const PAGE_GAP_ABOVE = 8;
// Longer than a smooth scroll to any page takes.
const JUMP_SETTLE_MS = 900;
const MIN_ZOOM = 50;
const MAX_ZOOM = 300;

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

interface Anchor {
  page: number;
  // How far into the page the top of the reading area is, as a fraction of the page's height.
  fraction: number;
  // Or, when the page starts below the top of the reading area, that gap in pixels (it does not scale).
  gap: number;
  // The horizontal centre of the reading area, as a fraction of the scrollable width.
  centre: number;
}

// The document card: a top row, the pages, and a floating bar with page and zoom controls. From
// md up the card has a fixed height and the pages scroll inside it; on a phone the window scrolls
// and the top row and the bar stay in view. Focus mode lets the card cover the whole viewport.
export function ReaderCard({ pdf, sizes, resourceId }: { pdf: PDFDocumentProxy; sizes: PageSize[]; resourceId: string }) {
  const total = pdf.numPages;
  const desktop = useMediaQuery("(min-width: 768px)");
  const [focus, setFocus] = useState(false);
  // Inside the card the pages scroll in their own box; otherwise the window scrolls them.
  const inner = desktop || focus;

  const cardRef = useRef<HTMLElement>(null);
  const topRowRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  // The scrolling box: in state so effects and the pages' observers follow it, and in a ref for
  // the code that moves its scroll position.
  const [scroller, setScrollerState] = useState<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const setScroller = useCallback((element: HTMLDivElement | null) => {
    scrollerRef.current = element;
    setScrollerState(element);
  }, []);
  const [available, setAvailable] = useState({ width: 0, height: 0 });
  const [mode, setMode] = useState<ZoomMode>({ kind: "width" });
  const [current, setCurrent] = useState(1);
  const [draft, setDraft] = useState<string | null>(null);
  // The viewer only runs in the browser (no server render), so storage can be read right away.
  const [offer, setOffer] = useState<number | null>(() => pageToOffer(readLastPage(resourceId), total));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);

  // ---- Zoom -------------------------------------------------------------------------------
  const maxWidth = Math.max(...sizes.map((s) => s.width));
  const maxHeight = Math.max(...sizes.map((s) => s.height));
  const ready = available.width > 0;
  const fitPercent = !ready
    ? 100
    : mode.kind === "page"
      ? fitPagePercent(available.width, available.height, maxWidth, maxHeight)
      : fitWidthPercent(available.width, maxWidth);
  const percent = mode.kind === "zoom" ? mode.percent : fitPercent;

  const zoomBy = useCallback((direction: 1 | -1) => setMode({ kind: "zoom", percent: stepZoom(percent, direction) }), [percent]);

  // The reading area's size, debounced so dragging a window edge does not redraw every page at
  // every step. The first measurement (and the first after the layout changes) is applied at once.
  useEffect(() => {
    if (!scroller) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;
    const measure = () => {
      const height = inner ? scroller.clientHeight : window.innerHeight - PHONE_CHROME;
      setAvailable({
        width: Math.max(1, scroller.clientWidth - 2 * PADDING),
        height: Math.max(1, height - 2 * PADDING),
      });
    };
    const schedule = () => {
      clearTimeout(timer);
      if (first) {
        first = false;
        measure();
      } else {
        timer = setTimeout(measure, RESIZE_DEBOUNCE_MS);
      }
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);
    window.addEventListener("resize", schedule);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [scroller, inner]);

  // ---- Where the reader is ----------------------------------------------------------------
  // The part of the screen the pages are seen through.
  const viewport = useCallback(() => {
    if (inner && scroller) {
      const box = scroller.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    }
    const bar = topRowRef.current?.getBoundingClientRect();
    return { top: Math.max(0, bar?.bottom ?? 0), bottom: window.innerHeight - PHONE_TAB_BAR };
  }, [inner, scroller]);

  const pageElements = useCallback(
    () => (scroller ? Array.from(scroller.querySelectorAll<HTMLElement>("[data-page]")) : []),
    [scroller],
  );

  const anchorRef = useRef<Anchor | null>(null);
  // While the reader is being taken to a page (a smooth scroll), the pages passing by do not
  // change the current page: it is the one asked for.
  const jumpUntil = useRef(0);

  // The current page is the one with the most of itself on screen; the ends win at the ends.
  const update = useCallback(() => {
    if (!scroller) return;
    const view = viewport();
    let best: HTMLElement | null = null;
    let bestVisible = 0;
    for (const element of pageElements()) {
      const box = element.getBoundingClientRect();
      const visible = Math.min(view.bottom, box.bottom) - Math.max(view.top, box.top);
      if (visible > bestVisible) {
        best = element;
        bestVisible = visible;
      }
    }
    if (!best) return;
    const box = best.getBoundingClientRect();
    const page = Number(best.dataset.page);
    anchorRef.current = {
      page,
      fraction: Math.max(0, view.top - box.top) / box.height,
      gap: Math.max(0, box.top - view.top),
      centre: scroller.scrollWidth > 0 ? (scroller.scrollLeft + scroller.clientWidth / 2) / scroller.scrollWidth : 0.5,
    };
    let shown = page;
    if (inner && scroller.scrollTop <= 0) shown = 1;
    else if (inner && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) shown = total;
    if (performance.now() >= jumpUntil.current) setCurrent(shown);
  }, [scroller, viewport, pageElements, inner, total]);

  useEffect(() => {
    if (!scroller) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, [scroller, update]);

  // Keep the reader on the same page when the zoom, the width or the layout changes: put the same
  // part of the same page back at the top of the reading area.
  const lastLayout = useRef<string | null>(null);
  useLayoutEffect(() => {
    const key = `${ready}|${Math.round(percent * 100)}|${inner}`;
    const before = lastLayout.current;
    lastLayout.current = key;
    const anchor = anchorRef.current;
    // Nothing to keep before the first layout, or when only the first measurement arrived.
    if (!scroller || !anchor || before === null || !before.startsWith("true")) return;
    const element = scroller.querySelector<HTMLElement>(`[data-page="${anchor.page}"]`);
    if (!element) return;
    const area = scrollerRef.current;
    if (!area) return;
    // A smooth scroll still on its way would carry on to a place that no longer exists.
    if (inner) area.scrollTo({ top: area.scrollTop, behavior: "instant" });
    else window.scrollTo({ top: window.scrollY, behavior: "instant" });
    const view = viewport();
    const box = element.getBoundingClientRect();
    const delta = box.top - view.top - anchor.gap + anchor.fraction * box.height;
    if (inner) area.scrollTop += delta;
    else window.scrollBy(0, delta);
    area.scrollLeft = anchor.centre * area.scrollWidth - area.clientWidth / 2;
  }, [ready, percent, inner, scroller, viewport]);

  const goTo = useCallback(
    (wanted: number) => {
      const page = clampPage(wanted, total);
      const element = scroller?.querySelector<HTMLElement>(`[data-page="${page}"]`);
      if (!scroller || !element) return;
      const delta = element.getBoundingClientRect().top - viewport().top - PAGE_GAP_ABOVE;
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      if (inner) scrollerRef.current?.scrollBy({ top: delta, behavior });
      else window.scrollBy({ top: delta, behavior });
      setCurrent(page);
      // Settle on what is really in view once the scroll is over.
      const duration = behavior === "smooth" ? JUMP_SETTLE_MS : 50;
      jumpUntil.current = performance.now() + duration;
      setTimeout(update, duration + 50);
    },
    [scroller, viewport, inner, total, update],
  );

  // ---- The page box -----------------------------------------------------------------------
  const commitDraft = () => {
    if (draft === null) return;
    const page = parsePageInput(draft, total);
    setDraft(null);
    if (page !== null) goTo(page);
  };

  // ---- Continue reading -------------------------------------------------------------------
  const currentRef = useRef(1);
  const moved = useRef(false);
  const offerRef = useRef<number | null>(null);
  useEffect(() => {
    currentRef.current = current;
    offerRef.current = offer;
  });
  useEffect(() => {
    // Do not replace the remembered page with page 1 before the reader has gone anywhere.
    if (current === 1 && !moved.current) return;
    moved.current = true;
    const timer = setTimeout(() => writeLastPage(resourceId, current), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [current, resourceId]);
  useEffect(() => {
    const save = () => {
      if (moved.current) writeLastPage(resourceId, currentRef.current);
    };
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [resourceId]);

  // ---- Focus mode -------------------------------------------------------------------------
  const usedFullscreen = useRef(false);
  const enterFocus = () => {
    setFocus(true);
    // The whole page is made fullscreen, not just the card, so menus (which are drawn at the end
    // of the page) stay visible. Not relied on: the overlay alone is focus mode.
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) {
      root.requestFullscreen().then(
        () => (usedFullscreen.current = true),
        () => {},
      );
    }
  };
  const exitFocus = useCallback(() => {
    setFocus(false);
    if (document.fullscreenElement) {
      usedFullscreen.current = false;
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const wasFocus = useRef(false);
  useEffect(() => {
    if (focus) {
      wasFocus.current = true;
      const html = document.documentElement;
      const previous = html.style.overflow;
      html.style.overflow = "hidden";
      cardRef.current?.focus({ preventScroll: true });
      const onFullscreenChange = () => {
        if (!document.fullscreenElement && usedFullscreen.current) {
          usedFullscreen.current = false;
          setFocus(false);
        }
      };
      document.addEventListener("fullscreenchange", onFullscreenChange);
      return () => {
        html.style.overflow = previous;
        document.removeEventListener("fullscreenchange", onFullscreenChange);
      };
    }
    if (wasFocus.current) {
      wasFocus.current = false;
      menuButtonRef.current?.focus({ preventScroll: true });
    }
  }, [focus]);

  // Leaving the page while in fullscreen must not leave the browser in it.
  useEffect(
    () => () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    },
    [],
  );

  // ---- Keyboard ---------------------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target)) return;
      // Menus and sheets have their own keys.
      if (event.target instanceof Element && event.target.closest('[role="menu"], [role="dialog"]')) return;
      if (menuOpenRef.current) return;
      switch (event.key) {
        case "ArrowLeft":
        case "PageUp":
          goTo(current - 1);
          break;
        case "ArrowRight":
        case "PageDown":
          goTo(current + 1);
          break;
        case "Home":
          goTo(1);
          break;
        case "End":
          goTo(total);
          break;
        case "+":
        case "=":
          zoomBy(1);
          break;
        case "-":
          zoomBy(-1);
          break;
        case "0":
          setMode({ kind: "width" });
          break;
        case "Escape":
          if (!focus) return;
          exitFocus();
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, zoomBy, exitFocus, current, total, focus]);

  // ---- Render -----------------------------------------------------------------------------
  const barPadding = focus ? "pb-[calc(1rem+env(safe-area-inset-bottom))]" : "pb-4";

  return (
    <section
      ref={cardRef}
      tabIndex={-1}
      aria-label="Document"
      className={cn(
        "flex flex-col border bg-card outline-none",
        focus ? "fixed inset-0 z-50 h-dvh overflow-hidden border-0" : "rounded-xl",
        desktop && !focus && "h-[max(30rem,calc(100dvh-13rem))] overflow-hidden",
      )}
    >
      <div
        ref={topRowRef}
        className={cn(
          "z-20 flex shrink-0 items-center gap-1 border-b bg-card px-2",
          desktop ? "h-12" : "h-[52px]",
          !focus && "rounded-t-xl",
          !inner && "sticky top-14",
        )}
      >
        {/* Room for the Contents button on the left and Search on the right, which come later. */}
        <div className="flex-1" />
        <ReaderMenu
          id={resourceId}
          sheet={!desktop}
          fit={mode.kind === "zoom" ? null : mode.kind}
          focus={focus}
          open={menuOpen}
          onOpenChange={(open) => {
            menuOpenRef.current = open;
            setMenuOpen(open);
          }}
          onFit={(fit) => setMode({ kind: fit })}
          onFocus={() => (focus ? exitFocus() : enterFocus())}
          triggerRef={menuButtonRef}
        />
      </div>

      <div className={cn("relative", inner && "min-h-0 flex-1")}>
        <div
          ref={setScroller}
          className={cn("bg-muted [overflow-anchor:none]", inner ? "absolute inset-0 overflow-auto" : "overflow-x-auto rounded-b-xl")}
        >
          <div className={cn("flex w-max min-w-full flex-col items-center gap-3 p-4", !ready && "invisible")}>
            {sizes.map((size, i) => {
              const css = pageCssSize(size.width, size.height, percent);
              return (
                <PageCanvas
                  key={i}
                  pdf={pdf}
                  number={i + 1}
                  total={total}
                  pointsWidth={size.width}
                  cssWidth={css.width}
                  cssHeight={css.height}
                  root={inner ? scroller : null}
                  ready={ready}
                />
              );
            })}
          </div>
        </div>

        {/* On a phone this sits just above the fixed tab bar and follows the window; otherwise it
            floats at the bottom of the reading area. Not a live region: the page number changes on
            every scroll step, and each page canvas is already labelled. */}
        <div
          className={cn(
            "pointer-events-none z-10",
            inner ? "absolute inset-x-0 bottom-0" : "sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] h-0",
          )}
        >
          <div
            className={cn(
              "flex flex-col items-center gap-2 px-3",
              inner ? barPadding : "absolute inset-x-0 bottom-0",
            )}
          >
            {offer !== null && (
              <div
                role="region"
                aria-label="Continue reading"
                className="pointer-events-auto flex max-w-full items-center gap-2 rounded-xl border bg-card py-1.5 pr-1.5 pl-3 text-sm text-heading shadow-lg"
              >
                <span>Continue where you left off, page {offer}?</span>
                <Button
                  className="h-10"
                  onClick={() => {
                    goTo(offer);
                    setOffer(null);
                  }}
                >
                  Go
                </Button>
                <Button variant="ghost" size="icon" className="size-10" aria-label="Dismiss" onClick={() => setOffer(null)}>
                  <X aria-hidden />
                </Button>
              </div>
            )}

            <div
              role="group"
              aria-label="Page and zoom"
              className="pointer-events-auto flex items-center gap-0.5 rounded-full border bg-card px-1.5 py-0.5 text-sm text-heading shadow-lg"
            >
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full"
                aria-label="Previous page"
                disabled={current <= 1}
                onClick={() => goTo(current - 1)}
              >
                <ChevronLeft aria-hidden />
              </Button>
              {desktop ? (
                <>
                  <Input
                    aria-label="Page number"
                    inputMode="numeric"
                    autoComplete="off"
                    className="h-10 w-12 px-1 text-center tabular-nums"
                    value={draft ?? String(current)}
                    onFocus={(event) => {
                      setDraft(String(current));
                      event.currentTarget.select();
                    }}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={commitDraft}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitDraft();
                        event.currentTarget.blur();
                      } else if (event.key === "Escape") {
                        event.stopPropagation();
                        setDraft(null);
                        event.currentTarget.blur();
                      }
                    }}
                  />
                  <span className="pr-1 tabular-nums">/ {total}</span>
                </>
              ) : (
                <span className="px-1 tabular-nums">
                  {current} / {total}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full"
                aria-label="Next page"
                disabled={current >= total}
                onClick={() => goTo(current + 1)}
              >
                <ChevronRight aria-hidden />
              </Button>
              <span aria-hidden className="mx-1 h-5 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full"
                aria-label="Zoom out"
                disabled={percent <= MIN_ZOOM + 0.5}
                onClick={() => zoomBy(-1)}
              >
                <Minus aria-hidden />
              </Button>
              <span data-testid="zoom-percent" className="min-w-12 text-center tabular-nums">
                {Math.round(percent)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 rounded-full"
                aria-label="Zoom in"
                disabled={percent >= MAX_ZOOM - 0.5}
                onClick={() => zoomBy(1)}
              >
                <Plus aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

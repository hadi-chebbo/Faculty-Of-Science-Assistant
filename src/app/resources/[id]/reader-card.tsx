"use client";

import { ChevronLeft, ChevronRight, Minus, PanelLeft, Plus, Search, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PageCanvas, type PageHits } from "./page-canvas";
import { ReaderContents, useOutline } from "./reader-contents";
import { ReaderMenu } from "./reader-menu";
import { readContentsOpen, writeContentsOpen } from "./reader-panel";
import { pageToOffer, readLastPage, writeLastPage } from "./reader-position";
import { ReaderSearchBar } from "./reader-search-bar";
import { createTapTracker } from "./reader-tap";
import {
  clampPage,
  fitAreaWidth,
  fitPagePercent,
  fitWidthPercent,
  pageCssSize,
  parsePageInput,
  stepZoom,
  type ZoomMode,
} from "./reader-zoom";
import { useAutoHide } from "./use-auto-hide";
import { useDocumentSearch } from "./use-document-search";

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
// The search bar under the top row (a 40px box and its padding, and a border).
const SEARCH_BAR_HEIGHT = 49;
// Typing pauses this long before the search runs.
const SEARCH_DEBOUNCE_MS = 250;
// A search match is looked for on its page for this many animation frames (the page's text layer
// may still be on its way) before the reader gives up on centring it.
const REVEAL_FRAMES = 180;
const PAGE_GAP_ABOVE = 8;
// Longer than a smooth scroll to any page takes.
const JUMP_SETTLE_MS = 900;
const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
// A touch this soon after the page last scrolled is stopping a momentum scroll, not tapping.
const MOMENTUM_MS = 150;

const toPoint = (event: { clientX: number; clientY: number; timeStamp: number }) => ({ x: event.clientX, y: event.clientY, time: event.timeStamp });

function useMediaQuery(query: string): boolean {
  // Stable functions per query: a new subscribe on every render would re-subscribe every time.
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    [query],
  );
  const snapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

// Makes everything outside the card unreachable (by Tab, pointer and screen readers) and returns
// the way back. Menus and sheets opened later are added to the end of the page after this runs, so
// they stay usable. The menu that turned focus mode on is still fading out at this moment: it is
// made inert like the rest, or Tab could land on it while it closes.
function makeRestInert(card: HTMLElement | null): () => void {
  const changed: Element[] = [];
  for (let node: Element | null = card; node && node !== document.body; node = node.parentElement) {
    for (const sibling of Array.from(node.parentElement?.children ?? [])) {
      if (sibling === node || ["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName) || sibling.hasAttribute("inert")) continue;
      sibling.setAttribute("inert", "");
      changed.push(sibling);
    }
  }
  return () => changed.forEach((element) => element.removeAttribute("inert"));
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
  const [draft, setDraftState] = useState<string | null>(null);
  // The same value in a ref, so a commit from a key press and the blur that follows it in the same
  // render cannot both see it.
  const draftRef = useRef<string | null>(null);
  const setDraft = useCallback((value: string | null) => {
    draftRef.current = value;
    setDraftState(value);
  }, []);
  // The viewer only runs in the browser (no server render), so storage can be read right away.
  const [offer, setOffer] = useState<number | null>(() => pageToOffer(readLastPage(resourceId), total));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Contents: on a wide screen a panel beside the pages (remembered); on a phone a sheet.
  const [contentsOpen, setContentsOpen] = useState(() => readContentsOpen());
  const [sheetOpen, setSheetOpen] = useState(false);
  const panelShown = desktop && contentsOpen;

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

  // On a phone the window scrolls and the search bar takes room from the pages' view.
  const phoneSearch = !inner && searchOpen;

  const zoomBy = useCallback((direction: 1 | -1) => setMode({ kind: "zoom", percent: stepZoom(percent, direction) }), [percent]);

  // The reading area's size, debounced so dragging a window edge does not redraw every page at
  // every step. The first measurement (and the first after the layout changes) is applied at once.
  useEffect(() => {
    if (!scroller) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;
    const measure = () => {
      const height = inner ? scroller.clientHeight : window.innerHeight - PHONE_CHROME - (phoneSearch ? SEARCH_BAR_HEIGHT : 0);
      setAvailable({
        width: fitAreaWidth(scroller.clientWidth, desktop),
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
  }, [scroller, inner, desktop, phoneSearch]);

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
  // The page that scroll is taking the reader to.
  const jumpPage = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  // On a phone the floating bar hides while reading and a tap on the pages brings it back. It is
  // held open while a menu is open, keyboard focus is inside it or a scroll to a page is still
  // moving. (There is no page box on a phone; on desktop the bar never hides.)
  const barRef = useRef<HTMLDivElement>(null);
  // Keyboard focus is on a usable control of the bar. A tap that merely focuses a button does not
  // count (:focus-visible), and neither does a button that became disabled while focused.
  const keyboardInBar = useCallback(() => {
    const active = document.activeElement;
    return (
      active instanceof HTMLElement &&
      barRef.current?.contains(active) === true &&
      active.matches(":focus-visible") &&
      !(active instanceof HTMLButtonElement && active.disabled)
    );
  }, []);
  const barHeld = useCallback(
    () => menuOpenRef.current || keyboardInBar() || performance.now() < jumpUntil.current,
    [keyboardInBar],
  );
  const bar = useAutoHide(!desktop, barHeld);
  const { poke: pokeBar } = bar;
  const tapTracker = useRef(createTapTracker());
  // The last time anything scrolled: a touch that lands within a moment of it stops a momentum
  // scroll, it is not a tap.
  const lastScroll = useRef(0);

  // The current page is the one with the most of itself on screen; the ends win at the ends.
  const update = useCallback(() => {
    // Before the pages have their real sizes the document is not the one the reader will see, and
    // a position measured on it must not become the page the reader is on.
    if (!scroller || !ready) return;
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
  }, [scroller, ready, viewport, pageElements, inner, total]);

  useEffect(() => {
    if (!scroller) return;
    let frame = 0;
    const onScroll = () => {
      lastScroll.current = performance.now();
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
    let anchor = anchorRef.current;
    // Nothing to keep before the first layout, or when only the first measurement arrived.
    if (!scroller || !anchor || before === null || !before.startsWith("true")) return;
    // The layout changed while the reader was being taken to a page (the Contents panel opening
    // narrows the pages a moment after it is used): stay on the way to that page, not on the old one.
    if (performance.now() < jumpUntil.current && jumpPage.current > 0) {
      anchor = { page: jumpPage.current, fraction: 0, gap: PAGE_GAP_ABOVE, centre: anchor.centre };
    }
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
      jumpPage.current = page;
      pokeBar();
      clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(update, duration + 50);
    },
    [scroller, viewport, inner, total, update, pokeBar],
  );

  // ---- The page box -----------------------------------------------------------------------
  const commitDraft = () => {
    const text = draftRef.current;
    if (text === null) return;
    const page = parsePageInput(text, total);
    setDraft(null);
    if (page !== null) goTo(page);
  };

  // The window must not move by itself while the pages come in. The browser would otherwise put
  // the old scroll position back into the short page before the pages exist (on a slow phone), and
  // then scroll anchoring would carry it down with the pages as they grow, landing a reload on the
  // last page. So restoration is off (getting back to the place is the continue-reading notice's
  // job) and so is anchoring on the page itself; the reader keeps its own place when sizes change.
  // A layout effect, so it applies before the first layout of the pages.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const previousRestoration = history.scrollRestoration;
    const previousAnchor = html.style.overflowAnchor;
    history.scrollRestoration = "manual";
    html.style.overflowAnchor = "none";
    return () => {
      history.scrollRestoration = previousRestoration;
      html.style.overflowAnchor = previousAnchor;
    };
  }, []);

  // ---- Continue reading -------------------------------------------------------------------
  const currentRef = useRef(1);
  const moved = useRef(false);
  useEffect(() => {
    currentRef.current = current;
  });
  useEffect(() => {
    // Do not replace the remembered page with page 1 before the reader has gone anywhere.
    if (current === 1 && !moved.current) return;
    moved.current = true;
    const timer = setTimeout(() => writeLastPage(resourceId, current), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [current, resourceId]);
  // Save at once when the reader is about to leave. Leaving by an in-app link or Back does not fire
  // pagehide, and the route change scrolls the window to the top before the page unmounts, which
  // would make "the current page" 1: so the position is saved from the event that starts the
  // leaving (a link click, popstate, the tab being hidden), never from the unmount itself.
  useEffect(() => {
    const save = () => {
      if (moved.current) writeLastPage(resourceId, currentRef.current);
    };
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a[href]")) save();
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") save();
    };
    window.addEventListener("pagehide", save);
    window.addEventListener("popstate", save);
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", save);
      window.removeEventListener("popstate", save);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onHidden);
    };
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
      const restoreInert = makeRestInert(cardRef.current);
      const onFullscreenChange = () => {
        if (!document.fullscreenElement && usedFullscreen.current) {
          usedFullscreen.current = false;
          setFocus(false);
        }
      };
      document.addEventListener("fullscreenchange", onFullscreenChange);
      return () => {
        html.style.overflow = previous;
        restoreInert();
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

  // ---- Contents ---------------------------------------------------------------------------
  const outline = useOutline(pdf, panelShown || sheetOpen);
  const toggleContents = () => {
    const next = !contentsOpen;
    setContentsOpen(next);
    writeContentsOpen(next);
  };
  const chooseContents = (page: number) => {
    if (desktop) {
      goTo(page);
      return;
    }
    // The sheet closes first; the scroll lock it puts on the page is gone a moment later.
    setSheetOpen(false);
    setTimeout(() => goTo(page), 60);
  };

  // ---- Search -----------------------------------------------------------------------------
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [focusSearch, setFocusSearch] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const { status: search, step: stepSearch } = useDocumentSearch(pdf, searchOpen ? term : "", () => currentRef.current);

  useEffect(() => {
    if (!searchOpen) return;
    const timer = setTimeout(() => setTerm(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, searchOpen]);
  useEffect(() => {
    if (focusSearch === 0) return;
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [focusSearch]);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setFocusSearch((n) => n + 1);
  }, []);
  const closeSearch = useCallback((returnFocus: boolean) => {
    setSearchOpen(false);
    setQuery("");
    setTerm("");
    if (returnFocus) searchButtonRef.current?.focus({ preventScroll: true });
  }, []);

  // Taking the reader to a search match: the match's page first, then the match itself near the
  // middle of the reading area once the page's text layer has marked it.
  const revealFrame = useRef(0);
  const reveal = useCallback(
    (page: number) => {
      const area = scrollerRef.current;
      if (!area) return;
      cancelAnimationFrame(revealFrame.current);
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
      jumpUntil.current = performance.now() + 1000;
      jumpPage.current = page;
      setCurrent(page);

      const pageElement = area.querySelector<HTMLElement>(`[data-page="${page}"]`);
      if (pageElement) {
        const delta = pageElement.getBoundingClientRect().top - viewport().top - PAGE_GAP_ABOVE;
        if (inner) area.scrollBy({ top: delta, behavior: "instant" });
        else window.scrollBy({ top: delta, behavior: "instant" });
      }

      const attempt = () => {
        if (cancelled) return;
        const mark = area.querySelector<HTMLElement>(`[data-page="${page}"] mark.reader-hit-current`);
        if (mark) {
          const box = mark.getBoundingClientRect();
          const view = viewport();
          const delta = box.top + box.height / 2 - (view.top + view.bottom) / 2;
          if (inner) area.scrollBy({ top: delta, behavior: "instant" });
          else window.scrollBy({ top: delta, behavior: "instant" });
          if (area.scrollWidth > area.clientWidth + 1) {
            const areaBox = area.getBoundingClientRect();
            area.scrollLeft += box.left + box.width / 2 - (areaBox.left + areaBox.width / 2);
          }
          stop();
          jumpUntil.current = performance.now() + 100;
          clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(update, 150);
        } else if (++frames < REVEAL_FRAMES) {
          revealFrame.current = requestAnimationFrame(attempt);
        } else {
          stop();
          clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(update, 50);
        }
      };
      revealFrame.current = requestAnimationFrame(attempt);
    },
    [viewport, inner, update],
  );
  const revealRef = useRef(reveal);
  useEffect(() => {
    revealRef.current = reveal;
  });
  useEffect(() => () => cancelAnimationFrame(revealFrame.current), []);
  // A new search result, or a step to another match.
  useEffect(() => {
    if (!searchOpen || search.kind !== "done") return;
    const match = search.result.flat[search.current];
    if (match) revealRef.current(match.page);
  }, [searchOpen, search]);

  const hitsOf = (page: number): PageHits | undefined => {
    if (!searchOpen || search.kind !== "done") return undefined;
    const matches = search.result.byPage.get(page);
    if (!matches) return undefined;
    const match = search.result.flat[search.current];
    return { matches, current: match?.page === page ? match.index : null };
  };

  // ---- Keyboard ---------------------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // Ctrl+F / Cmd+F opens our search instead of the browser's, which cannot see the page's text
      // while it is drawn on canvases. Menus and sheets keep the browser's.
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "f") {
        if (menuOpenRef.current || (event.target instanceof Element && event.target.closest('[role="menu"], [role="dialog"]'))) return;
        event.preventDefault();
        openSearch();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target)) return;
      // Menus and sheets have their own keys.
      if (event.target instanceof Element && event.target.closest('[role="menu"], [role="dialog"]')) return;
      if (menuOpenRef.current) return;
      switch (event.key) {
        case "ArrowLeft":
        case "ArrowRight": {
          // Zoomed in far enough to scroll sideways: the arrows are for that.
          const area = scrollerRef.current;
          if (area && area.scrollWidth > area.clientWidth + 1) return;
          goTo(event.key === "ArrowLeft" ? current - 1 : current + 1);
          break;
        }
        case "PageUp":
          goTo(current - 1);
          break;
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
          // Esc closes the search first, then leaves focus mode.
          if (searchOpen) closeSearch(false);
          else if (focus) exitFocus();
          else return;
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, zoomBy, exitFocus, current, total, focus, searchOpen, openSearch, closeSearch]);

  // ---- Render -----------------------------------------------------------------------------
  const barHidden = !bar.shown;
  const barPadding = focus ? "pb-[calc(1rem+env(safe-area-inset-bottom))]" : "pb-4";

  return (
    <section
      ref={cardRef}
      tabIndex={-1}
      aria-label="Document"
      onKeyDownCapture={(event) => {
        // Any forward Tab inside the card reaches a hidden bar: show it first so it can take the focus.
        if (event.key === "Tab" && !event.shiftKey && barHidden && event.currentTarget.contains(event.target as Node)) bar.show();
      }}
      className={cn(
        "flex flex-col border bg-card outline-none",
        focus ? "fixed inset-0 z-50 h-dvh overflow-hidden border-0" : "rounded-xl",
        desktop && !focus && "h-[max(30rem,calc(100dvh-13rem))] overflow-hidden",
      )}
    >
      {/* The top row holds only Contents (left) and Search and More actions (right). The search bar,
          when open, hangs under it inside the same sticky box. */}
      <div ref={topRowRef} className={cn("z-20 shrink-0 border-b bg-card", !focus && "rounded-t-xl", !inner && "sticky top-14")}>
        <div className={cn("flex items-center gap-1 px-2", desktop ? "h-12" : "h-[52px]")}>
          {desktop ? (
            <Button
              variant="ghost"
              className={cn("h-10 gap-2 px-3", contentsOpen && "bg-accent text-accent-foreground")}
              aria-expanded={contentsOpen}
              aria-controls="reader-contents"
              onClick={toggleContents}
            >
              <PanelLeft aria-hidden />
              Contents
            </Button>
          ) : (
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className={cn("size-10", sheetOpen && "bg-accent text-accent-foreground")} aria-label="Contents">
                  <PanelLeft aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="gap-0 pb-[env(safe-area-inset-bottom)]">
                <SheetHeader>
                  <SheetTitle>Contents</SheetTitle>
                  <SheetDescription className="sr-only">Go to a part of the document.</SheetDescription>
                </SheetHeader>
                <ReaderContents pdf={pdf} sizes={sizes} outline={outline} current={current} onSelect={chooseContents} />
              </SheetContent>
            </Sheet>
          )}
          <div className="flex-1" />
          <Button
            ref={searchButtonRef}
            variant="ghost"
            size="icon"
            className={cn("size-10", searchOpen && "bg-accent text-accent-foreground")}
            aria-label="Search in document"
            aria-expanded={searchOpen}
            onClick={() => (searchOpen ? closeSearch(false) : openSearch())}
          >
            <Search aria-hidden />
          </Button>
          <ReaderMenu
            id={resourceId}
            sheet={!desktop}
            fit={mode.kind === "zoom" ? null : mode.kind}
            focus={focus}
            open={menuOpen}
            onOpenChange={(open) => {
              menuOpenRef.current = open;
              setMenuOpen(open);
              if (!open) pokeBar();
            }}
            onFit={(fit) => setMode({ kind: fit })}
            onFocus={() => (focus ? exitFocus() : enterFocus())}
            triggerRef={menuButtonRef}
          />
        </div>
        {searchOpen && (
          <ReaderSearchBar
            query={query}
            onQueryChange={(value) => {
              setQuery(value);
              if (!value.trim()) setTerm("");
            }}
            status={search}
            onStep={stepSearch}
            onFlush={() => setTerm(query)}
            pending={query !== term}
            onClose={() => closeSearch(true)}
            inputRef={searchInputRef}
          />
        )}
      </div>

      <div className={cn(inner && "flex min-h-0 flex-1")}>
        {panelShown && (
          <aside id="reader-contents" className="flex w-[200px] shrink-0 flex-col border-r bg-card pt-3">
            <p aria-hidden className="px-4 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Contents
            </p>
            <ReaderContents pdf={pdf} sizes={sizes} outline={outline} current={current} onSelect={chooseContents} />
          </aside>
        )}
      <div className={cn("relative", inner && "min-h-0 min-w-0 flex-1")}>
        <div
          ref={setScroller}
          onPointerDown={(event) => {
            if (desktop || (event.pointerType === "mouse" && event.button !== 0)) return;
            if (performance.now() - lastScroll.current < MOMENTUM_MS) return;
            tapTracker.current.down(event.pointerId, toPoint(event));
          }}
          onPointerMove={(event) => {
            if (!desktop) tapTracker.current.move(event.pointerId, toPoint(event));
          }}
          onPointerCancel={(event) => tapTracker.current.cancel(event.pointerId)}
          onPointerUp={(event) => {
            const tapped = tapTracker.current.up(event.pointerId, toPoint(event));
            if (!tapped || desktop) return;
            // A tap on a control is that control's, not the page's.
            if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea, [role='button']")) return;
            // Never take the bar away from someone using it with the keyboard.
            if (keyboardInBar()) bar.show();
            else bar.toggle();
          }}
          className={cn("touch-manipulation bg-reader-surface [overflow-anchor:none]", inner ? "absolute inset-0 overflow-auto" : "overflow-x-auto rounded-b-xl")}
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
                  hits={hitsOf(i + 1)}
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
              ref={barRef}
              // A press during the fade-out still works and brings the bar back.
              onPointerDownCapture={bar.show}
              onKeyDownCapture={bar.show}
              className={cn(
                "flex items-center gap-0.5 rounded-full border bg-card px-1.5 py-0.5 text-sm text-heading shadow-lg",
                "duration-200 motion-reduce:transition-none",
                // Hiding waits for the fade before the bar leaves the tab order and stops taking
                // presses (visibility: hidden does both); showing makes it focusable at once (a Tab
                // that reveals it must be able to land on it).
                "pointer-events-auto",
                barHidden ? "invisible translate-y-2 opacity-0 transition-[opacity,transform,visibility]" : "transition-[opacity,transform]",
              )}
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
      </div>
    </section>
  );
}

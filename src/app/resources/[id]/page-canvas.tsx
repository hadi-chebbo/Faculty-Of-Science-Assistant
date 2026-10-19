"use client";

import type { PDFDocumentProxy, PDFPageProxy, RenderTask, TextLayer } from "pdfjs-dist";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { applyHighlights } from "./reader-highlight";
import type { PageMatch } from "./reader-search";
import { MAX_CANVAS_PIXELS_SMALL, canvasPixelRatio } from "./reader-zoom";

// Pages within this distance of the viewport are drawn; the rest are empty placeholders.
const RENDER_MARGIN = "150% 0px";

// The search matches of one page: all of them, and which one is the current match, if it is here.
export interface PageHits {
  matches: PageMatch[];
  current: number | null;
}

// The page's text as the text layer holds it: one element and one string per PDF text item.
interface LayerText {
  elements: HTMLElement[];
  strings: string[];
}

// One page: a white sheet of the size it is shown at, with a canvas and a text layer (so the text
// can be selected, and search matches shown) drawn only while it is near the screen. `root` is the
// element that scrolls the pages, or null when the window does.
export const PageCanvas = memo(function PageCanvas({
  pdf,
  number,
  total,
  pointsWidth,
  cssWidth,
  cssHeight,
  root,
  ready,
  hits,
}: {
  pdf: PDFDocumentProxy;
  number: number;
  total: number;
  pointsWidth: number;
  cssWidth: number;
  cssHeight: number;
  root: Element | null;
  ready: boolean;
  hits?: PageHits;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [layerText, setLayerText] = useState<LayerText | null>(null);
  // The text layer and its page, kept so a zoom change can lay the text out again.
  const layerRef = useRef<{ layer: TextLayer; page: PDFPageProxy } | null>(null);
  // The size the text layer is laid out for, in CSS pixels per PDF point.
  const scaleRef = useRef(cssWidth / pointsWidth);
  useEffect(() => {
    scaleRef.current = cssWidth / pointsWidth;
  }, [cssWidth, pointsWidth]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root,
      rootMargin: RENDER_MARGIN,
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [root]);

  const draw = useCallback(
    async (canvas: HTMLCanvasElement, isCancelled: () => boolean, setTask: (task: RenderTask) => void) => {
      const page = await pdf.getPage(number);
      if (isCancelled()) return;
      // Touch and small screens get a lower memory budget per canvas.
      const small = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
      const ratio = canvasPixelRatio(cssWidth, cssHeight, window.devicePixelRatio, 2, small ? MAX_CANVAS_PIXELS_SMALL : undefined);
      const viewport = page.getViewport({ scale: (cssWidth / pointsWidth) * ratio });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const task = page.render({ canvas, viewport });
      setTask(task);
      await task.promise;
    },
    [pdf, number, pointsWidth, cssWidth, cssHeight],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!near || !ready) {
      // Far from the screen: give the pixels back, and let PDF.js free the page's own data. The
      // wrapper keeps its size.
      canvas.width = 0;
      canvas.height = 0;
      if (ready) void pdf.getPage(number).then((page) => page.cleanup(), () => {});
      return;
    }
    let cancelled = false;
    let task: RenderTask | undefined;
    draw(canvas, () => cancelled, (t) => (task = t)).catch((error: unknown) => {
      if (error instanceof Error && error.name === "RenderingCancelledException") return;
      console.error(`reader failed to draw page ${number}`, error);
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [near, ready, draw, number, pdf]);

  // The text layer is built once when the page comes near and freed when it goes far; zooming only
  // changes --scale-factor (see the next effect), so a selection or a match survives it. A scanned
  // page has no text: the layer is simply empty.
  useEffect(() => {
    const container = textRef.current;
    if (!container || !near || !ready) return;
    let cancelled = false;
    let layer: TextLayer | undefined;
    (async () => {
      const [{ TextLayer: Layer }, page] = await Promise.all([import("pdfjs-dist"), pdf.getPage(number)]);
      if (cancelled) return;
      container.style.setProperty("--scale-factor", String(scaleRef.current));
      layer = new Layer({ textContentSource: page.streamTextContent(), container, viewport: page.getViewport({ scale: scaleRef.current }) });
      // PDF.js sizes the layer with variables of its own page box; this box already has the size.
      container.style.width = "100%";
      container.style.height = "100%";
      layerRef.current = { layer, page };
      await layer.render();
      if (cancelled) return;
      setLayerText({ elements: layer.textDivs, strings: layer.textContentItemsStr });
    })().catch((error: unknown) => {
      if (cancelled || (error instanceof Error && error.name === "AbortException")) return;
      console.error(`reader failed to build the text of page ${number}`, error);
    });
    return () => {
      cancelled = true;
      layer?.cancel();
      layerRef.current = null;
      container.replaceChildren();
      setLayerText(null);
    };
  }, [near, ready, pdf, number]);

  useEffect(() => {
    const container = textRef.current;
    if (!container) return;
    const scale = cssWidth / pointsWidth;
    container.style.setProperty("--scale-factor", String(scale));
    const built = layerRef.current;
    if (built && layerText) built.layer.update({ viewport: built.page.getViewport({ scale }) });
  }, [cssWidth, pointsWidth, layerText]);

  // Search matches go on the text layer once it exists, and come off again when they change.
  const matches = hits?.matches;
  const current = hits?.current ?? null;
  useEffect(() => {
    if (!layerText || !matches || matches.length === 0) return;
    return applyHighlights(layerText.elements, layerText.strings, matches, current);
  }, [layerText, matches, current]);

  return (
    <div
      ref={wrapperRef}
      data-page={number}
      className="relative shrink-0 bg-white shadow-md ring-1 ring-black/10 dark:shadow-black/60 dark:ring-white/30"
      style={{ width: cssWidth, height: cssHeight }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Page ${number} of ${total}`}
        className="absolute inset-0 size-full"
      />
      {/* The page's text, invisible over the canvas: it is what is selected and copied, and what a
          screen reader reads (the canvas itself only has its "Page N of M" label). */}
      <div ref={textRef} className="reader-text" />
    </div>
  );
});

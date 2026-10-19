"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";
import { canvasPixelRatio } from "./reader-zoom";

// Pages within this distance of the viewport are drawn; the rest are empty placeholders.
const RENDER_MARGIN = "150% 0px";

// One page: a white sheet of the size it is shown at, with a canvas drawn only while it is near
// the screen. `root` is the element that scrolls the pages, or null when the window does.
export function PageCanvas({
  pdf,
  number,
  total,
  pointsWidth,
  cssWidth,
  cssHeight,
  root,
  ready,
}: {
  pdf: PDFDocumentProxy;
  number: number;
  total: number;
  pointsWidth: number;
  cssWidth: number;
  cssHeight: number;
  root: Element | null;
  ready: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);

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
      const ratio = canvasPixelRatio(cssWidth, cssHeight, window.devicePixelRatio);
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

  return (
    <div
      ref={wrapperRef}
      data-page={number}
      className="relative shrink-0 bg-white shadow-md ring-1 ring-black/5"
      style={{ width: cssWidth, height: cssHeight }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Page ${number} of ${total}`}
        className="absolute inset-0 size-full"
      />
    </div>
  );
}

"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Thumbnails start drawing a little before they scroll into view, measured against the list that scrolls them.
const NEAR_MARGIN = "300px 0px";
// Shown width in CSS pixels.
const THUMB_WIDTH = 112;

// A page's thumbnail as a button that goes to the page. The small canvas is drawn only while the
// button is near the visible part of the list and is given back when it is not, so a long file
// does not keep hundreds of canvases.
export function ThumbnailButton({
  pdf,
  number,
  size,
  active,
  onSelect,
  root,
}: {
  pdf: PDFDocumentProxy;
  number: number;
  // The page's size in PDF points.
  size: { width: number; height: number };
  active: boolean;
  onSelect: (page: number) => void;
  // The scrolling list the thumbnail is in.
  root: Element;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const height = Math.round((THUMB_WIDTH * size.height) / size.width);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { root, rootMargin: NEAR_MARGIN });
    observer.observe(button);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!near) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    let cancelled = false;
    let task: RenderTask | undefined;
    (async () => {
      const page = await pdf.getPage(number);
      if (cancelled) return;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale: (THUMB_WIDTH / size.width) * ratio });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, viewport });
      await task.promise;
    })().catch((error: unknown) => {
      if (error instanceof Error && error.name === "RenderingCancelledException") return;
      console.error(`reader failed to draw the thumbnail of page ${number}`, error);
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [near, pdf, number, size.width]);

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(number)}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg border border-transparent p-2 text-sm text-foreground outline-none",
        "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-primary/40 bg-accent font-semibold text-primary",
      )}
    >
      <span className="block bg-white shadow-sm ring-1 ring-black/10" style={{ width: THUMB_WIDTH, height }}>
        <canvas ref={canvasRef} aria-hidden className="size-full" />
      </span>
      <span className="tabular-nums">Page {number}</span>
    </button>
  );
}

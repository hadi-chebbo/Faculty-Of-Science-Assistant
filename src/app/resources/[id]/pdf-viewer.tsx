"use client";

import { FileWarning } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ReaderActions } from "./reader-actions";
import { ViewerSkeleton } from "./viewer-skeleton";

// Cap the pixel ratio: a 3x canvas of a full-width page costs a lot of memory for little gain.
const MAX_PIXEL_RATIO = 2;
// Pages within this distance of the viewport are drawn; the rest are empty placeholders.
const RENDER_MARGIN = "150% 0px";
const RESIZE_DEBOUNCE_MS = 150;

type State =
  | { status: "loading"; percent: number | null }
  | { status: "error" }
  | { status: "ready"; pdf: PDFDocumentProxy; ratios: number[] };

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  // The worker is a separate file. `new URL(..., import.meta.url)` makes Next.js (Turbopack)
  // copy it to the build output and gives its address, both in `next dev` and `next build`;
  // PDF.js then starts it as a module worker. Set once, before the first document.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  return pdfjs;
}

// All pages of one PDF in a single vertical scroll, each fit to the width and drawn on a canvas
// (no text layer yet). The file comes from the same-origin open route, which redirects to a
// short-lived signed URL; range requests and streaming are off so the browser makes one plain
// GET, with no Range header and so no CORS preflight.
export function PdfViewer({ resourceId }: { resourceId: string }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ status: "loading", percent: null });

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;

    (async () => {
      const pdfjs = await loadPdfjs();
      // Left the page while PDF.js was loading: do not start the download.
      if (cancelled) return;
      const task = pdfjs.getDocument({
        url: new URL(`/api/v1/resources/${resourceId}/open`, window.location.origin).toString(),
        disableRange: true,
        disableStream: true,
      });
      destroy = () => void task.destroy();
      task.onProgress = ({ loaded, total }: { loaded: number; total?: number }) => {
        if (cancelled || !total) return;
        setState({ status: "loading", percent: Math.min(100, Math.round((loaded / total) * 100)) });
      };
      const pdf = await task.promise;
      if (cancelled) return;

      // Page shapes, so every placeholder has the right height before its page is drawn. The first
      // page shows the viewer at once; the others fill in when they have been read.
      const sizeOf = async (number: number) => {
        const viewport = (await pdf.getPage(number)).getViewport({ scale: 1 });
        return viewport.height / viewport.width;
      };
      const first = await sizeOf(1);
      if (cancelled) return;
      setState({ status: "ready", pdf, ratios: Array<number>(pdf.numPages).fill(first) });
      if (pdf.numPages > 1) {
        // A page whose shape cannot be read keeps the first page's shape; the viewer stays up.
        const rest = await Promise.all(
          Array.from({ length: pdf.numPages - 1 }, (_, i) => sizeOf(i + 2).catch(() => first)),
        );
        if (!cancelled) setState({ status: "ready", pdf, ratios: [first, ...rest] });
      }
    })().catch((error: unknown) => {
      if (cancelled) return;
      console.error("reader failed to load the file", error);
      setState({ status: "error" });
    });

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [resourceId, attempt]);

  if (state.status === "loading") return <ViewerSkeleton percent={state.percent} />;
  if (state.status === "error") {
    return (
      <div role="alert" className="flex flex-col items-center rounded-xl border bg-card px-4 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileWarning className="size-6" aria-hidden />
        </span>
        <p className="mt-4 max-w-md">The file could not be shown here.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            variant="secondary"
            className="h-11 md:h-9"
            onClick={() => {
              setState({ status: "loading", percent: null });
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
          <ReaderActions id={resourceId} />
        </div>
      </div>
    );
  }
  return <Pages pdf={state.pdf} ratios={state.ratios} />;
}

function Pages({ pdf, ratios }: { pdf: PDFDocumentProxy; ratios: number[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [current, setCurrent] = useState(1);
  const total = pdf.numPages;

  // The container's width, debounced so dragging a window edge does not redraw every page at
  // every step. The first measurement is applied at once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      clearTimeout(timer);
      if (first) {
        first = false;
        setWidth(next);
      } else {
        timer = setTimeout(() => setWidth(next), RESIZE_DEBOUNCE_MS);
      }
    });
    observer.observe(container);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  // The current page is the one with the most of itself on screen.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const visible = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const number = Number((entry.target as HTMLElement).dataset.page);
          visible.set(number, entry.isIntersecting ? entry.intersectionRect.height : 0);
        }
        let best = 0;
        let bestHeight = 0;
        for (const [number, height] of visible) {
          if (height > bestHeight || (height === bestHeight && height > 0 && number < best)) {
            best = number;
            bestHeight = height;
          }
        }
        if (best > 0) setCurrent(best);
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
    );
    container.querySelectorAll("[data-page]").forEach((page) => observer.observe(page));
    return () => observer.disconnect();
  }, [total]);

  return (
    <div>
      <div ref={containerRef} className="space-y-3">
        {Array.from({ length: total }, (_, i) => (
          <PageCanvas key={i} pdf={pdf} number={i + 1} total={total} ratio={ratios[i]} width={width} />
        ))}
      </div>
      {/* Stays in view while reading; on phones it clears the fixed bottom tab bar. Not a live
          region: it changes on every scroll step, and each page canvas is already labelled. */}
      <p
        className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] z-10 mx-auto mt-3 w-fit rounded-full border bg-card px-3 py-1 text-sm text-heading shadow-xs md:bottom-4"
      >
        Page {current} of {total}
      </p>
    </div>
  );
}

function PageCanvas({
  pdf,
  number,
  total,
  ratio,
  width,
}: {
  pdf: PDFDocumentProxy;
  number: number;
  total: number;
  ratio: number;
  width: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: RENDER_MARGIN });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(
    async (canvas: HTMLCanvasElement, isCancelled: () => boolean, setTask: (task: RenderTask) => void) => {
      const page = await pdf.getPage(number);
      if (isCancelled()) return;
      const base = page.getViewport({ scale: 1 });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const viewport = page.getViewport({ scale: (width / base.width) * pixelRatio });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const task = page.render({ canvas, viewport });
      setTask(task);
      await task.promise;
    },
    [pdf, number, width],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!near || width === 0) {
      // Far from the screen: give the pixels back, and let PDF.js free the page's own data. The
      // wrapper keeps its height.
      canvas.width = 0;
      canvas.height = 0;
      if (width !== 0) void pdf.getPage(number).then((page) => page.cleanup(), () => {});
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
  }, [near, width, draw, number, pdf]);

  return (
    <div
      ref={wrapperRef}
      data-page={number}
      className="relative w-full overflow-hidden rounded-lg border bg-muted"
      style={{ aspectRatio: `1 / ${ratio}` }}
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

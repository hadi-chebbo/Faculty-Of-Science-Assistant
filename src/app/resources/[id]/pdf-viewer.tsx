"use client";

import { FileWarning } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ReaderActions } from "./reader-actions";
import { ReaderCard, type PageSize } from "./reader-card";
import { ViewerSkeleton } from "./viewer-skeleton";

type State =
  | { status: "loading"; percent: number | null }
  | { status: "error" }
  | { status: "ready"; pdf: PDFDocumentProxy; sizes: PageSize[] };

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

// Loads one PDF and hands it to the document card, which shows all its pages in a single vertical
// scroll, each drawn on a canvas (no text layer yet). The file comes from the same-origin open route, which redirects to a
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

      // Page sizes in PDF points, so every placeholder has the right size before its page is drawn.
      // The first page shows the viewer at once; the others fill in when they have been read.
      const sizeOf = async (number: number): Promise<PageSize> => {
        const viewport = (await pdf.getPage(number)).getViewport({ scale: 1 });
        return { width: viewport.width, height: viewport.height };
      };
      const first = await sizeOf(1);
      if (cancelled) return;
      setState({ status: "ready", pdf, sizes: Array<PageSize>(pdf.numPages).fill(first) });
      if (pdf.numPages > 1) {
        // A page whose size cannot be read keeps the first page's size; the viewer stays up.
        const rest = await Promise.all(
          Array.from({ length: pdf.numPages - 1 }, (_, i) => sizeOf(i + 2).catch(() => first)),
        );
        if (!cancelled) setState({ status: "ready", pdf, sizes: [first, ...rest] });
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
  // Keyed by the resource: a solution link reuses this page, and the new file starts from its own state.
  return <ReaderCard key={resourceId} pdf={state.pdf} sizes={state.sizes} resourceId={resourceId} />;
}

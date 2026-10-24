"use client";

import dynamic from "next/dynamic";
import { ViewerSkeleton } from "./viewer-skeleton";

// PDF.js is large, so it is fetched only on this page and only in the browser (ssr: false is
// allowed only in a Client Component, which is why this small wrapper exists).
export const PdfViewer = dynamic(() => import("./pdf-viewer").then((module) => module.PdfViewer), {
  ssr: false,
  loading: () => <ViewerSkeleton />,
});

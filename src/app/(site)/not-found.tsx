import type { Metadata } from "next";
import { NotFoundContent } from "@/components/site/not-found-content";
import { NOT_FOUND_TITLE } from "@/lib/page-title";

// Already inside the (site) layout, so no site frame here (the root not-found adds its own).
export const metadata: Metadata = { title: NOT_FOUND_TITLE };

export default function NotFound() {
  return <NotFoundContent />;
}

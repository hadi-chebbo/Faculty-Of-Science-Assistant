import type { Metadata } from "next";
import { NotFoundContent } from "@/components/site/not-found-content";
import { NOT_FOUND_TITLE } from "@/lib/page-title";
import { SiteChrome } from "@/components/site/site-chrome";

// Unmatched URLs only: they render outside the (site) layout, so this adds the site frame.
// notFound() called from a site page uses (site)/not-found.tsx, which sits inside that layout.
export const metadata: Metadata = { title: NOT_FOUND_TITLE };

export default function NotFound() {
  return (
    <SiteChrome>
      <NotFoundContent />
    </SiteChrome>
  );
}

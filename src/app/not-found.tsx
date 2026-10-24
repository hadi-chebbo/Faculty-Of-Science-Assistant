import { NotFoundContent } from "@/components/site/not-found-content";
import { SiteChrome } from "@/components/site/site-chrome";

// Unmatched URLs only: they render outside the (site) layout, so this adds the site frame.
// notFound() called from a site page uses (site)/not-found.tsx, which sits inside that layout.
export default function NotFound() {
  return (
    <SiteChrome>
      <NotFoundContent />
    </SiteChrome>
  );
}

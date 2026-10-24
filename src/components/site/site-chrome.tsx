import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

// The full site frame: header with navigation, the phone tab bar, and the footer.
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* Bottom padding keeps content and footer clear of the fixed phone tab bar. */}
      <div className="flex flex-1 flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    </>
  );
}

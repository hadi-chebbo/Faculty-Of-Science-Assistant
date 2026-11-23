import { Toaster } from "@/components/ui/sonner";
import { CelebrationDialogHost } from "./celebration-dialog-host";
import { SignInDialogHost } from "./sign-in-dialog-host";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

// The full site frame: header with navigation (the phone sidebar lives in the header), and the footer.
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* First in the Tab order; hidden until it has focus. Every site page's <main> is id="main". */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:outline-none focus:ring-[3px] focus:ring-ring/50"
      >
        Skip to content
      </a>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
      {/* At the top, so a message never covers the to-do board's + button or the reader's floating bar. */}
      <Toaster position="top-center" />
      <CelebrationDialogHost />
      <SignInDialogHost />
    </>
  );
}

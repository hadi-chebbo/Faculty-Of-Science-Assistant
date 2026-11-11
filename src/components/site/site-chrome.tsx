import { Toaster } from "@/components/ui/sonner";
import { CelebrationDialogHost } from "./celebration-dialog-host";
import { SignInDialogHost } from "./sign-in-dialog-host";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

// The full site frame: header with navigation (the phone sidebar lives in the header), and the footer.
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
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

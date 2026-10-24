import { BrandLink } from "@/components/site/brand-link";
import { DISCLAIMER } from "@/components/site/site-footer";
import { ThemeToggle } from "@/components/site/theme-toggle";

// Full-screen split used by every account page, instead of the site frame: the brand panel fills
// the left side on md and up; the right side holds a slim bar (brand on a phone, theme toggle),
// the form centred, and the disclaimer. The caller supplies the panel content and the form side.
export function AuthShell({ panel, children }: { panel: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 flex-col md:grid md:grid-cols-[2fr_3fr]">
      <aside
        data-testid="auth-panel"
        className="relative hidden flex-col justify-center overflow-hidden bg-brand-panel p-12 text-brand-panel-foreground md:flex lg:p-16"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-24 size-80 rounded-full bg-brand-panel-foreground/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -left-16 size-56 rounded-full bg-brand-panel-foreground/5"
        />
        <div className="relative max-w-sm">{panel}</div>
      </aside>
      <div className="flex flex-1 flex-col bg-card">
        <header className="flex h-14 items-center justify-between px-5 sm:px-8 md:justify-end md:px-10">
          <span className="md:hidden">
            <BrandLink />
          </span>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 justify-center px-5 py-6 sm:px-8 md:items-center md:px-10">
          <div className="w-full max-w-md">{children}</div>
        </main>
        <footer className="px-5 pb-6 text-center text-sm text-muted-foreground">{DISCLAIMER}</footer>
      </div>
    </div>
  );
}

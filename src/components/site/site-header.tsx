import { Suspense } from "react";
import { AccountControl } from "./account-control";
import { BrandLink } from "./brand-link";
import { NavItems } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

// usePathname suspends on routes whose params are only known at request time, so both
// navigation bars sit in a Suspense boundary and the rest of the shell stays static.
export function SiteHeader() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 lg:gap-6">
          <BrandLink />
          <nav aria-label="Main" className="ml-auto hidden items-center md:flex">
            <Suspense fallback={null}>
              <NavItems variant="top" />
            </Suspense>
          </nav>
          <div className="ml-auto flex items-center gap-1 md:ml-0 md:border-l md:pl-3">
            <Suspense fallback={<div aria-hidden className="size-11 md:size-9" />}>
              <AccountControl />
            </Suspense>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 border-t bg-card pb-[env(safe-area-inset-bottom)] box-content md:hidden"
      >
        <Suspense fallback={null}>
          <NavItems variant="bottom" />
        </Suspense>
      </nav>
    </>
  );
}

import { Suspense } from "react";
import { AccountControl } from "./account-control";
import { BrandLink } from "./brand-link";
import { MobileNav } from "./mobile-nav";
import { NavItems } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

// usePathname suspends on routes whose params are only known at request time, so the
// navigation items sit in a Suspense boundary and the rest of the shell stays static.
export function SiteHeader() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="page-container flex h-14 items-center gap-4 lg:gap-6">
          <Suspense fallback={<div aria-hidden className="-ml-2 size-11 md:hidden" />}>
            <MobileNav />
          </Suspense>
          <BrandLink />
          <nav aria-label="Main" className="ml-auto hidden items-center md:flex">
            <Suspense fallback={null}>
              <NavItems />
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
    </>
  );
}

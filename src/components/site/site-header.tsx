import Link from "next/link";
import { Suspense } from "react";
import { NavItems } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

// usePathname suspends on routes whose params are only known at request time, so both
// navigation bars sit in a Suspense boundary and the rest of the shell stays static.
export function SiteHeader() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
          <Link href="/" className="font-semibold tracking-tight text-heading">
            University Assistant
          </Link>
          <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
            <Suspense fallback={null}>
              <NavItems variant="top" />
            </Suspense>
          </nav>
          <div className="ml-auto md:ml-0">
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

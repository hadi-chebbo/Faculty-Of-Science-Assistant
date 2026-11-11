"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { BrandLink } from "./brand-link";
import { NAV_ITEMS, type NavItem } from "./nav-items";

const HEADING = "px-5 pb-1 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase";

// The phone navigation (below md): a hamburger in the top bar that opens a left sidebar with the same six
// items as the desktop bar, in two groups. Shown to everyone; it never waits for the session. The sheet's
// content mounts only while it is open, so one `nav[aria-label="Main"]` is exposed at a time.
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // A link tap closes the sheet (SheetClose); also close whenever the path changes by any other route.
  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setOpen(false);
  }

  const study = NAV_ITEMS.slice(0, 3);
  const own = NAV_ITEMS.slice(3);

  const row = ({ label, icon: Icon, href, isActive }: NavItem) => {
    const active = href !== undefined && (isActive?.(pathname) ?? false);
    return (
      <li key={label}>
        <SheetClose asChild>
          <Link
            href={href ?? "/"}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-12 items-center gap-3 px-5 text-[15px] font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset",
              active ? "bg-primary/5 text-link" : "text-muted-foreground hover:text-heading",
            )}
          >
            {active && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" />}
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        </SheetClose>
      </li>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" aria-label="Open menu" className="-ml-2 size-11 text-heading md:hidden">
          <Menu className="size-6" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="gap-0 pb-[env(safe-area-inset-bottom)] data-[side=left]:w-[280px] data-[side=left]:max-w-[85vw] data-[side=left]:sm:max-w-[85vw]"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b pr-2 pl-5">
          <SheetTitle className="text-base">
            <BrandLink />
          </SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
          <SheetClose asChild>
            <Button variant="ghost" aria-label="Close menu" className="size-11 text-muted-foreground">
              <X className="size-5" aria-hidden />
            </Button>
          </SheetClose>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto py-2">
          <p className={HEADING}>Study</p>
          <ul>{study.map(row)}</ul>
          <p className={cn(HEADING, "mt-2 border-t pt-4")}>Your pages</p>
          <ul>{own.map(row)}</ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

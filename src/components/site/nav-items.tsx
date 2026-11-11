"use client";

import { Bookmark, BookOpen, FileText, ListTodo, Search, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  // No href means a disabled item (a page that does not exist yet).
  href?: string;
  isActive?: (pathname: string) => boolean;
  // The first item of the student's own pages (Saved, To-do): a divider goes before it on desktop.
  startsOwnGroup?: boolean;
}

// Saved, To-do and Progress are shown to everyone. Signed out, their pages send the visitor through sign-in
// and back, so the bar never waits for the session and nothing moves once the page has loaded.
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Browse",
    icon: BookOpen,
    href: "/",
    isActive: (p) => p === "/" || p.startsWith("/semesters") || p.startsWith("/courses"),
  },
  { label: "Exams", icon: FileText, href: "/exams", isActive: (p) => p.startsWith("/exams") },
  { label: "Search", icon: Search, href: "/search", isActive: (p) => p.startsWith("/search") },
  { label: "Saved", icon: Bookmark, href: "/saved", isActive: (p) => p.startsWith("/saved"), startsOwnGroup: true },
  { label: "To-do", icon: ListTodo, href: "/todo", isActive: (p) => p.startsWith("/todo") },
  { label: "Progress", icon: TrendingUp, href: "/progress", isActive: (p) => p.startsWith("/progress") },
];

// The inline desktop items (the phone uses the sidebar in `mobile-nav.tsx`, which shares NAV_ITEMS).
// The current item has a primary underline along the bottom edge of the bar; icons show
// from lg up, so the six items fit beside the brand at md.
export function NavItems() {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map(({ label, icon: Icon, href, isActive, startsOwnGroup }) => {
        const active = href !== undefined && (isActive?.(pathname) ?? false);
        const className = cn(
          "relative flex h-14 items-center gap-1.5 px-2.5 text-sm font-medium outline-none lg:px-3",
          active && "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
          active ? "text-link" : "text-muted-foreground",
          !href && "cursor-not-allowed opacity-60",
          href && !active && "hover:text-heading",
          href && "rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset",
        );
        const content = (
          <>
            <Icon className="hidden size-4 lg:block" aria-hidden />
            {label}
          </>
        );
        const item = href ? (
          <Link href={href} aria-current={active ? "page" : undefined} className={className}>
            {content}
          </Link>
        ) : (
          <span aria-disabled="true" title="Coming soon" className={className}>
            {content}
          </span>
        );
        return (
          <Fragment key={label}>
            {startsOwnGroup && <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />}
            {item}
          </Fragment>
        );
      })}
    </>
  );
}

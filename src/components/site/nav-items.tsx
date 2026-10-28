"use client";

import { Bookmark, BookOpen, FileText, ListTodo, Search, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: LucideIcon;
  // No href means a disabled item (a page that does not exist yet).
  href?: string;
  isActive?: (pathname: string) => boolean;
  // The first item of the student's own pages (Saved, To-do): a divider goes before it on desktop.
  startsOwnGroup?: boolean;
  // Not in the phone tab bar (it keeps five items).
  desktopOnly?: boolean;
}

// Saved, To-do and Progress are shown to everyone. Signed out, their pages send the visitor through sign-in
// and back, so the bar never waits for the session and nothing moves once the page has loaded.
const ITEMS: NavItem[] = [
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
  { label: "Progress", icon: TrendingUp, href: "/progress", isActive: (p) => p.startsWith("/progress"), desktopOnly: true },
];

// "bottom" is the phone tab bar, "top" the inline desktop items.
// Desktop: the current item has a primary underline along the bottom edge of the bar; icons show
// from lg up, so the six items fit beside the brand at md.
// Phone: five equal tabs; the current one has its icon on a tinted pill.
export function NavItems({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();
  const bottom = variant === "bottom";

  return (
    <>
      {ITEMS.filter((item) => !(bottom && item.desktopOnly)).map(({ label, icon: Icon, href, isActive, startsOwnGroup }) => {
        const active = href !== undefined && (isActive?.(pathname) ?? false);
        const className = cn(
          "flex items-center font-medium outline-none",
          bottom
            ? "group min-w-0 flex-1 flex-col justify-center gap-0.5 text-[11px]"
            : "relative h-14 gap-1.5 px-2.5 text-sm lg:px-3",
          !bottom && active && "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
          active ? "text-link" : "text-muted-foreground",
          !href && "cursor-not-allowed opacity-60",
          href && !active && "hover:text-heading",
          href && (bottom ? "focus-visible:bg-muted" : "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset rounded-md"),
        );
        const content = bottom ? (
          <>
            <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-primary/10")}>
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="truncate">{label}</span>
          </>
        ) : (
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
            {startsOwnGroup && !bottom && <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />}
            {item}
          </Fragment>
        );
      })}
    </>
  );
}

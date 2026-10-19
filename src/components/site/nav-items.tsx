"use client";

import { BookOpen, FileText, Search, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: LucideIcon;
  // No href means a disabled item (a page that does not exist yet).
  href?: string;
  isActive?: (pathname: string) => boolean;
}

const ITEMS: NavItem[] = [
  {
    label: "Browse",
    icon: BookOpen,
    href: "/",
    isActive: (p) => p === "/" || p.startsWith("/semesters") || p.startsWith("/courses"),
  },
  { label: "Exams", icon: FileText, href: "/exams", isActive: (p) => p.startsWith("/exams") },
  { label: "Search", icon: Search, href: "/search", isActive: (p) => p.startsWith("/search") },
];

// "bottom" is the phone tab bar, "top" the inline desktop items.
export function NavItems({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();
  const bottom = variant === "bottom";

  return (
    <>
      {ITEMS.map(({ label, icon: Icon, href, isActive }) => {
        const active = href !== undefined && (isActive?.(pathname) ?? false);
        const className = cn(
          "flex items-center text-sm font-medium",
          bottom ? "flex-1 flex-col justify-center gap-0.5 text-xs" : "gap-1.5 rounded-md px-3 py-1.5",
          active ? "text-link md:bg-muted" : "text-muted-foreground",
          !href && "cursor-not-allowed opacity-60",
          href && !active && "hover:text-heading md:hover:bg-muted/60",
          href && "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        );
        const content = (
          <>
            <Icon className="size-5 md:size-4" aria-hidden />
            {label}
          </>
        );
        return href ? (
          <Link key={label} href={href} aria-current={active ? "page" : undefined} className={className}>
            {content}
          </Link>
        ) : (
          <span key={label} aria-disabled="true" title="Coming soon" className={className}>
            {content}
          </span>
        );
      })}
    </>
  );
}

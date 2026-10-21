import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { SignOutButton } from "@/app/admin/sign-out-button";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { key: "resources", label: "Resources", href: "/admin" },
  { key: "chapters", label: "Chapters", href: "/admin/chapters" },
  { key: "storage", label: "Storage", href: "/admin/storage" },
] as const;

// Plain row at the very top of every admin page: the admin sections on the left (the current one highlighted), sign out on the right.
// Rendered by the page content only after `requireAdminPage` has passed; it never reads the session itself.
export function AdminBar({ current }: { current: "resources" | "chapters" | "storage" }) {
  // Server-only variable: the link to the Sentry issues page, hidden when it is not set.
  const errorsUrl = process.env.SENTRY_ISSUES_URL;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <nav aria-label="Admin sections" className="flex flex-wrap items-center gap-1">
        {SECTIONS.map(({ key, label, href }) => {
          const active = key === current;
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-9",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-heading",
              )}
            >
              {label}
            </Link>
          );
        })}
        {errorsUrl ? (
          <a
            href={errorsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none hover:bg-muted/60 hover:text-heading focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-9"
          >
            Errors
            <ExternalLink aria-hidden="true" className="size-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
      </nav>
      <SignOutButton />
    </div>
  );
}

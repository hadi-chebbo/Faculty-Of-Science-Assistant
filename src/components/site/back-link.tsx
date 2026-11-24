import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

// The way back up on a phone, where the breadcrumb trail is hidden: "‹ Second year", "‹ DEMO301".
// Below md only, at least 44px tall. Desktop keeps the breadcrumbs.
export function BackLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      data-testid="back-link"
      className={`-ml-2 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-link md:hidden ${FOCUS}`}
    >
      <ArrowLeft aria-hidden className="size-4" />
      {children}
    </Link>
  );
}

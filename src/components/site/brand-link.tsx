import Link from "next/link";
import { BrandMark, Wordmark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";

// The brand lockup (mark and two-tone wordmark) that leads home, shared by the site header, the phone
// menu and the account pages' bar. Its accessible name is "UniMate".
// className is merged, not replaced, because SheetClose asChild in the phone menu passes props through.
export function BrandLink({ className, ...props }: Omit<React.ComponentProps<typeof Link>, "href">) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-md text-heading outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      <BrandMark />
      <Wordmark />
    </Link>
  );
}

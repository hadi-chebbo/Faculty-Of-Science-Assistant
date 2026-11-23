import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// The way back to browsing from every account page; sign-up needs no account to browse.
export function BackToCourses({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-link outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 ${className}`}
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back to courses
    </Link>
  );
}

"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// The filters are a plain GET form, so Apply works without JavaScript (the dropdowns fall back to native selects).
// With JavaScript the submit becomes a client-side navigation that leaves out empty ("All") fields to keep the
// address short; choosing a value in a dropdown submits the form (see `PopoverSelect`). The dropdowns follow the
// address themselves (their keys include the value the server settled on).
export function FilterForm({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const router = useRouter();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Below md the card is a disclosure: native <details>, so it opens without JavaScript. From md up
  // the CSS (`.filters-details`) shows the content whatever the state; this covers browsers without
  // `::details-content`.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) detailsRef.current?.setAttribute("open", "");
  }, []);

  return (
    <form
      action="/exams"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        const query = new URLSearchParams();
        for (const [name, value] of new FormData(event.currentTarget)) {
          if (typeof value === "string" && value !== "") query.set(name, value);
        }
        const text = query.toString();
        router.push(text ? `/exams?${text}` : "/exams");
      }}
    >
      <details ref={detailsRef} className="filters-details group">
        <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-xl border bg-card px-4 text-sm font-medium text-heading marker:hidden md:hidden [&::-webkit-details-marker]:hidden">
          <span>{activeCount > 0 ? `Filters (${activeCount})` : "Filters"}</span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-2 md:mt-0">{children}</div>
      </details>
    </form>
  );
}

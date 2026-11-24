"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// The filters are a plain GET form, so Apply works without JavaScript. With JavaScript this
// wrapper adds two things: a change in any dropdown submits the form, and the submit becomes a
// client-side navigation that leaves out empty ("All") fields to keep the address short.
// `values` are the filters the server settled on; they are copied into the dropdowns after each
// navigation (Back button, or a course dropped because it does not fit the semester).
export function FilterForm({ values, activeCount, children }: { values: Record<string, string>; activeCount: number; children: React.ReactNode }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const synced = JSON.stringify(values);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    for (const [name, value] of Object.entries(JSON.parse(synced) as Record<string, string>)) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLSelectElement && field.value !== value) field.value = value;
    }
  }, [synced]);

  // Below md the card is a disclosure: native <details>, so it opens without JavaScript. From md up
  // the CSS (`.filters-details`) shows the content whatever the state; this covers browsers without
  // `::details-content`.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) detailsRef.current?.setAttribute("open", "");
  }, []);

  return (
    <form
      ref={formRef}
      action="/exams"
      method="get"
      onChange={(event) => event.currentTarget.requestSubmit()}
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

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// The filters are a plain GET form, so Apply works without JavaScript. With JavaScript this
// wrapper adds two things: a change in any dropdown submits the form, and the submit becomes a
// client-side navigation that leaves out empty ("All") fields to keep the address short.
// `values` are the filters the server settled on; they are copied into the dropdowns after each
// navigation (Back button, or a course dropped because it does not fit the semester).
export function FilterForm({ values, children }: { values: Record<string, string>; children: React.ReactNode }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const synced = JSON.stringify(values);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    for (const [name, value] of Object.entries(JSON.parse(synced) as Record<string, string>)) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLSelectElement && field.value !== value) field.value = value;
    }
  }, [synced]);

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
      {children}
    </form>
  );
}

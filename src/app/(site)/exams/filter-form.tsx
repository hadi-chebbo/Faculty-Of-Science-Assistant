"use client";

import { useRouter } from "next/navigation";

// The filters are a plain GET form, so Apply works without JavaScript (the dropdowns fall back to native selects).
// With JavaScript the submit becomes a client-side navigation that leaves out empty ("All") fields to keep the
// address short; choosing a value in a dropdown submits the form (see `PopoverSelect`).
export function FilterForm({ children }: { children: React.ReactNode }) {
  const router = useRouter();

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
      {children}
    </form>
  );
}

"use client";

import { Search } from "lucide-react";
import { useState } from "react";

// What the field hints at, one after another while it is empty (decoration only; see `.hint-cycle`).
const HINTS = ["Course code or topic", "Try: final 2025", "Try: graphs", "Try: partial"];

// The home page's search field. It is a plain GET form to the search page (`q`), so it works without
// JavaScript: typing stays here, Enter or the button opens /search?q=WORDS. The rotating hint shows only while
// the field is empty and is hidden from assistive technology; the field has its own label.
export function HomeSearch() {
  const [value, setValue] = useState("");
  return (
    <form
      action="/search"
      method="get"
      role="search"
      className="mx-auto mt-8 flex max-w-2xl items-center gap-3 rounded-2xl border bg-background py-2 pl-4 pr-2 text-left text-lg shadow-xl shadow-primary/10 transition-[box-shadow,border-color] focus-within:border-primary/60 focus-within:ring-[3px] focus-within:ring-ring/40"
    >
      <Search aria-hidden className="size-5 shrink-0 text-link" />
      <div className="relative min-w-0 flex-1">
        <input
          type="search"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="Search courses, chapters and files"
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-11 w-full bg-transparent text-foreground outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
        {value === "" && (
          <span aria-hidden="true" className="hint-cycle pointer-events-none absolute inset-0 text-muted-foreground">
            {HINTS.map((hint, index) => (
              <span
                key={hint}
                className="absolute inset-0 flex items-center overflow-hidden whitespace-nowrap"
                style={{ animationDelay: `${index * 2.5}s` }}
              >
                {hint}
              </span>
            ))}
          </span>
        )}
      </div>
      <button
        type="submit"
        className="h-11 shrink-0 rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground transition-transform motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Search
      </button>
    </form>
  );
}

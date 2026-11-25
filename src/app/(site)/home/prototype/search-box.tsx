"use client";
// PROTOTYPE (throwaway): a real search field. Typing stays on the page; Enter or the button goes to /search?q=...
// It is a plain GET form, so it also works without JavaScript. The rotating hint shows only while the box is empty.
import { Search } from "lucide-react";
import { useState } from "react";

const HINTS = ["Search by course code or topic", "Try: final exam 2025", "Try: graphs", "Try: partial"];

export function SearchBox({ className = "" }: { className?: string }) {
  const [value, setValue] = useState("");
  return (
    <form
      action="/search"
      method="get"
      role="search"
      className={`flex items-center gap-3 rounded-2xl border bg-background px-4 py-3.5 shadow-lg shadow-primary/10 transition-[box-shadow,border-color] focus-within:border-primary/60 focus-within:shadow-xl focus-within:ring-[3px] focus-within:ring-ring/40 ${className}`}
    >
      <Search aria-hidden className="size-5 shrink-0 text-link" />
      <div className="relative min-w-0 flex-1">
        <input
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Search courses, chapters and files"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-7 w-full bg-transparent text-foreground outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
        {value === "" && (
          <span aria-hidden className="proto-cycle pointer-events-none absolute inset-0 overflow-hidden text-muted-foreground">
            {HINTS.map((t, i) => (
              <span key={t} className="absolute inset-0 truncate" style={{ animationDelay: `${i * 2.5}s` }}>{t}</span>
            ))}
          </span>
        )}
      </div>
      <button type="submit" className="h-9 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">
        Search
      </button>
    </form>
  );
}

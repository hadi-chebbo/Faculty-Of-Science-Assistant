"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { SEARCH_MAX_LENGTH } from "@/services/search/query";
import { searchHref } from "./href";
import type { SearchChip } from "@/services/search/query";

const DEBOUNCE_MS = 300;

// The search box is a plain GET form, so it works without JavaScript: type, press Search. With
// JavaScript the results follow the typing: a short pause after the last key the address is
// replaced (no history entry per keystroke), and the page below reads the new address.
// `q` and `type` are what the server read from the address. The box is not controlled: the text is
// the visitor's. It is overwritten only when the address changed for a reason other than this box
// (Back, Forward, a link); the answer to anything the box itself sent, however late it arrives
// (a slow connection delivers "algo" after the visitor has typed "algor"), never touches it.
export function SearchForm({ q, type }: { q: string; type?: SearchChip }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Every text this box has put into the address.
  const sent = useRef(new Set([q]));

  useEffect(() => {
    const input = inputRef.current;
    if (input && !sent.current.has(q)) {
      sent.current.add(q);
      input.value = q;
    }
  }, [q]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function go(text: string) {
    clearTimeout(timer.current);
    const trimmed = text.trim();
    sent.current.add(trimmed);
    router.replace(searchHref({ q: trimmed, type }), { scroll: false });
  }

  return (
    <form
      action="/search"
      method="get"
      role="search"
      className="flex items-center gap-2 rounded-2xl border bg-background py-1.5 pl-4 pr-1.5 shadow-lg shadow-primary/10 transition-[box-shadow,border-color] focus-within:border-primary/60 focus-within:ring-[3px] focus-within:ring-ring/40"
      onSubmit={(event) => {
        event.preventDefault();
        go(inputRef.current?.value ?? "");
      }}
    >
      <Search aria-hidden className="size-5 shrink-0 text-link" />
      <div className="relative min-w-0 flex-1">
        <label htmlFor="search-q" className="sr-only">
          Search courses, chapters and files
        </label>
        <input
          ref={inputRef}
          id="search-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Course code, topic or exam"
          maxLength={SEARCH_MAX_LENGTH}
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          // Chrome draws its own clear button in a search field; ours is drawn once, below.
          className="peer h-11 w-full bg-transparent pr-11 text-base text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          onChange={(event) => {
            clearTimeout(timer.current);
            const text = event.currentTarget.value;
            timer.current = setTimeout(() => go(text), DEBOUNCE_MS);
          }}
        />
        {/* Shown only while the box has text (the placeholder is not showing). */}
        <button
          type="button"
          aria-label="Clear search"
          className="absolute right-0 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground outline-none hover:text-heading focus-visible:ring-[3px] focus-visible:ring-ring/50 peer-[:not(:placeholder-shown)]:flex"
          onClick={() => {
            const input = inputRef.current;
            if (input) {
              input.value = "";
              input.focus();
            }
            go("");
          }}
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      {/* After the box, so the address reads q first. */}
      {type && <input type="hidden" name="type" value={type} />}
      {/* Hidden on a phone (Enter submits), but visible while it has the keyboard focus. */}
      <button
        type="submit"
        className="h-11 shrink-0 rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground transition-transform focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:hover:-translate-y-0.5 max-md:[&:not(:focus)]:sr-only"
      >
        Search
      </button>
    </form>
  );
}

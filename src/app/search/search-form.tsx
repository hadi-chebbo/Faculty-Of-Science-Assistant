"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 300;
const MAX_LENGTH = 100;

// The search box is a plain GET form, so it works without JavaScript: type, press Search. With
// JavaScript the results follow the typing: a short pause after the last key the address is
// replaced (no history entry per keystroke), and the page below reads the new address.
// `q` and `type` are what the server read from the address. The box is not controlled: the text is
// the visitor's, and is only overwritten when the address changed for another reason (Back, a link),
// never by the answer to what they typed a moment ago.
export function SearchForm({ q, type }: { q: string; type?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The text the address was last set to from this box.
  const sent = useRef(q);

  useEffect(() => {
    const input = inputRef.current;
    if (input && q !== sent.current) {
      sent.current = q;
      input.value = q;
    }
  }, [q]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function go(text: string) {
    clearTimeout(timer.current);
    const trimmed = text.trim();
    sent.current = trimmed;
    const query = new URLSearchParams();
    if (trimmed) query.set("q", trimmed);
    if (type) query.set("type", type);
    const rest = query.toString();
    router.replace(rest ? `/search?${rest}` : "/search", { scroll: false });
  }

  return (
    <form
      action="/search"
      method="get"
      role="search"
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        go(inputRef.current?.value ?? "");
      }}
    >
      <div className="relative flex-1">
        <label htmlFor="search-q" className="sr-only">
          Search courses, chapters and files
        </label>
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          id="search-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Course code, topic or exam"
          maxLength={MAX_LENGTH}
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          // Chrome draws its own clear button in a search field; ours is drawn once, below.
          className="peer h-12 rounded-lg bg-card pl-10 pr-11 text-base shadow-none md:h-12 md:text-base [&::-webkit-search-cancel-button]:hidden"
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
          className="absolute right-1 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-heading focus-visible:ring-[3px] focus-visible:ring-ring/50 peer-[:not(:placeholder-shown)]:flex"
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
      <Button type="submit" className="sr-only h-12 px-5 md:not-sr-only md:inline-flex">
        Search
      </Button>
    </form>
  );
}

"use client";

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import type { Ref } from "react";
import { Button } from "@/components/ui/button";
import { countLabel } from "./reader-search";
import type { SearchStatus } from "./use-document-search";

// The bar under the top row: a box to type in, how many matches there are, previous and next
// match, and close. Enter goes to the next match, Shift+Enter to the previous one.
export function ReaderSearchBar({
  query,
  onQueryChange,
  status,
  onStep,
  onFlush,
  pending,
  onClose,
  inputRef,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  status: SearchStatus;
  onStep: (direction: 1 | -1) => void;
  // Search now, without waiting for typing to pause.
  onFlush: () => void;
  // The text was typed after the last search started, so Enter searches instead of stepping.
  pending: boolean;
  onClose: () => void;
  inputRef: Ref<HTMLInputElement>;
}) {
  const matches = status.kind === "done" ? status.result.flat.length : 0;
  const label = status.kind === "done" ? countLabel(status.result, status.current) : "";

  return (
    <div role="search" className="flex items-center gap-1 border-t px-2 py-1">
      <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-background px-2.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Find in document</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Find in document"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              // A search still waiting for typing to pause starts now; otherwise Enter steps.
              if (pending) onFlush();
              else onStep(event.shiftKey ? -1 : 1);
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {/* Only the finished count is announced; the percentage while searching is for the eye. */}
        <span aria-live="polite" className="shrink-0 text-sm whitespace-nowrap text-muted-foreground tabular-nums">
          {label}
        </span>
        {status.kind === "searching" && (
          <span aria-hidden className="shrink-0 text-sm whitespace-nowrap text-muted-foreground tabular-nums">
            Searching… {status.percent}%
          </span>
        )}
      </label>
      <Button variant="ghost" size="icon" className="size-10" aria-label="Previous match" disabled={matches === 0} onClick={() => onStep(-1)}>
        <ChevronUp aria-hidden />
      </Button>
      <Button variant="ghost" size="icon" className="size-10" aria-label="Next match" disabled={matches === 0} onClick={() => onStep(1)}>
        <ChevronDown aria-hidden />
      </Button>
      <Button variant="ghost" size="icon" className="size-10" aria-label="Close search" onClick={onClose}>
        <X aria-hidden />
      </Button>
    </div>
  );
}

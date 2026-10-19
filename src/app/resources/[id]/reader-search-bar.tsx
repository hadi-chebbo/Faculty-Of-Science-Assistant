"use client";

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import type { Ref } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          aria-label="Find in document"
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
          className="h-10 rounded-lg bg-card pr-28 pl-9 focus-visible:border-primary focus-visible:ring-primary/25 dark:bg-card [&::-webkit-search-cancel-button]:hidden"
        />
        <div className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2 text-sm whitespace-nowrap text-muted-foreground tabular-nums">
          {/* Only the finished count is announced; the percentage while searching is for the eye. */}
          <span aria-live="polite">{label}</span>
          {status.kind === "searching" && <span aria-hidden>Searching… {status.percent}%</span>}
        </div>
      </div>
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

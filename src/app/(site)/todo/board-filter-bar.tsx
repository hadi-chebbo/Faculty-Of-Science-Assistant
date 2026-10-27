"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { chipClass } from "../search/chips";
import { ALL_COURSES, NOTES_ONLY, type BoardFilter } from "./board-filter";

// "Filter cards" and the chips above the board (variant D): All, one chip per course that has
// cards, and Notes only. One chip at a time; on a phone the chips scroll sideways. The filter
// lives in the board's state only.
export function BoardFilterBar({
  filter,
  codes,
  onChange,
}: {
  filter: BoardFilter;
  codes: string[];
  onChange: (filter: BoardFilter) => void;
}) {
  const chips = [{ key: ALL_COURSES, label: "All" }, ...codes.map((code) => ({ key: code, label: code })), { key: NOTES_ONLY, label: "Notes only" }];
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center">
      <div className="relative md:w-64 md:shrink-0">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={filter.text}
          onChange={(event) => onChange({ ...filter, text: event.target.value })}
          placeholder="Filter cards"
          aria-label="Filter cards"
          autoComplete="off"
          className="h-11 bg-card pl-9 md:h-9"
        />
      </div>
      <div role="group" aria-label="Filter by course" className="-mx-4 min-w-0 md:mx-0">
        <ul className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:px-0">
          {chips.map((chip) => {
            const active = filter.chip === chip.key;
            return (
              <li key={chip.key} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ ...filter, chip: chip.key })}
                  className={cn(chipClass(active), "cursor-pointer", chip.key !== ALL_COURSES && chip.key !== NOTES_ONLY && "font-mono text-xs")}
                >
                  {chip.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

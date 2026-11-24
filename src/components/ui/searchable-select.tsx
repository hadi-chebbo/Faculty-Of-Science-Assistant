"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  label: string;
  // Options with the same group sit under one small heading (for example "Second year · Semester 1").
  group?: string;
}

interface Props {
  options: SearchableOption[];
  // Posted in forms through a hidden input, so plain GET and POST forms keep working.
  name?: string;
  id?: string;
  // Shown in the dialog title and used for the search box ("course" gives "Search courses…").
  noun: string;
  // The "no value" row (value ""), e.g. "All courses" or "None". Leave out when a value is required.
  emptyLabel?: string;
  // Trigger text while nothing is chosen and there is no emptyLabel.
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  "aria-invalid"?: boolean;
  className?: string;
}

// A select that opens a picker with a search box. It is a drop-in for a native select on long lists:
// same name/value/onValueChange shape, and the value is posted through a hidden input.
export function SearchableSelect({
  options,
  name,
  id,
  noun,
  emptyLabel,
  placeholder,
  value: controlled,
  defaultValue = "",
  onValueChange,
  disabled,
  required,
  className,
  ...rest
}: Props) {
  const [inner, setInner] = useState(defaultValue);
  const value = controlled ?? inner;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  // The rows shown: the empty row (when there is one and no search is typed), then matches.
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
    const showEmpty = emptyLabel !== undefined && (!needle || emptyLabel.toLowerCase().includes(needle));
    const all: SearchableOption[] = showEmpty ? [{ value: "", label: emptyLabel }] : [];
    return [...all, ...matches];
  }, [options, query, emptyLabel]);

  const selected = options.find((o) => o.value === value);
  const triggerText = selected?.label ?? (value === "" && emptyLabel !== undefined ? emptyLabel : placeholder ?? `Choose a ${noun}`);

  function choose(next: string) {
    if (controlled === undefined) setInner(next);
    onValueChange?.(next);
    setOpen(false);
  }

  function openChange(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      const at = rows.findIndex((r) => r.value === value);
      setActive(Math.max(at, 0));
    }
  }

  function move(to: number) {
    const clamped = Math.min(Math.max(to, 0), rows.length - 1);
    setActive(clamped);
    listRef.current?.querySelector(`[data-index="${clamped}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(active + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(active - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rows[active]) choose(rows[active].value);
    }
  }

  const count = rows.filter((r) => r.value !== "").length;
  let lastGroup: string | undefined;

  return (
    <Dialog open={open} onOpenChange={openChange}>
      {name && <input type="hidden" name={name} value={value} />}
      <DialogTrigger
        id={id}
        type="button"
        disabled={disabled}
        aria-invalid={rest["aria-invalid"]}
        aria-required={required}
        aria-haspopup="dialog"
        className={cn(
          "flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-2.5 text-left text-sm shadow-xs outline-none transition-[color,box-shadow] md:h-9",
          "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
          !selected && value === "" && emptyLabel === undefined && "text-muted-foreground",
          className,
        )}
      >
        <span className="truncate">{triggerText}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DialogTrigger>
      <DialogContent className="top-[8vh] translate-y-0 gap-3 p-3 sm:top-[12vh]" onKeyDown={onKeyDown}>
        <DialogTitle className="px-1 pt-1 text-base">Choose a {noun}</DialogTitle>
        <DialogDescription className="sr-only">Type to search, use the arrow keys and Enter to pick.</DialogDescription>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
            aria-label={`Search ${noun}s`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder={`Search ${noun}s…`}
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-md border border-input bg-background pr-10 pl-9 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-10 md:text-sm"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setActive(0);
              }}
              className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <div ref={listRef} id={listId} role="listbox" aria-label={`${noun}s`} className="max-h-[50vh] overflow-y-auto overscroll-contain">
          {rows.map((row, i) => {
            const heading = row.group && row.group !== lastGroup ? row.group : null;
            lastGroup = row.group;
            const isSelected = row.value === value;
            return (
              <div key={row.value || "__empty"}>
                {heading && <p className="px-2 pt-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{heading}</p>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  data-index={i}
                  onMouseMove={() => active !== i && setActive(i)}
                  onClick={() => choose(row.value)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-md px-2 text-sm md:min-h-9",
                    i === active && "bg-muted",
                    isSelected && "font-medium text-link",
                    row.value === "" && "text-muted-foreground",
                  )}
                >
                  <span>{row.label}</span>
                  {isSelected && <Check className="size-4 shrink-0" aria-hidden />}
                </div>
              </div>
            );
          })}
          {count === 0 && <p className="px-2 py-4 text-center text-sm text-muted-foreground">No {noun} matches “{query}”.</p>}
        </div>
        <p className="px-1 text-xs text-muted-foreground" aria-live="polite">
          {count} {count === 1 ? noun : `${noun}s`}
        </p>
      </DialogContent>
    </Dialog>
  );
}

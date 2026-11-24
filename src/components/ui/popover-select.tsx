"use client";

import { Check, ChevronDown } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface PopoverOption {
  value: string;
  label: string;
  // Options with the same group sit under one small heading.
  group?: string;
}

const subscribeNever = () => () => {};

// With more options than this, the list gets a search box.
const SEARCH_FROM = 8;

// A select that opens a small list under the button (a search box on long lists). The value is posted through
// a hidden input. When `submitOnChange` is set, choosing a value submits the surrounding form.
// Without JavaScript the button is hidden and `fallback` (a native select) takes its place.
export function PopoverSelect({
  options,
  name,
  id,
  value: initial,
  emptyLabel,
  noun,
  submitOnChange,
  fallback,
  className,
}: {
  options: PopoverOption[];
  name: string;
  id: string;
  // The value the server settled on. Give the component a `key` that includes it so it follows the address.
  value: string;
  emptyLabel: string;
  noun: string;
  submitOnChange?: boolean;
  fallback?: React.ReactNode;
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const hidden = useRef<HTMLInputElement>(null);
  // The hidden input exists only once JavaScript runs, so without it the native fallback is the only field posted.
  const scripted = useSyncExternalStore(subscribeNever, () => true, () => false);

  const searchable = options.length > SEARCH_FROM;
  const needle = query.trim().toLowerCase();
  const matches = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  const rows: PopoverOption[] = [...(!needle || emptyLabel.toLowerCase().includes(needle) ? [{ value: "", label: emptyLabel }] : []), ...matches];
  const current = options.find((o) => o.value === value)?.label ?? emptyLabel;

  function choose(next: string) {
    setValue(next);
    setOpen(false);
    if (hidden.current) hidden.current.value = next;
    if (submitOnChange && next !== value) hidden.current?.form?.requestSubmit();
  }

  let lastGroup: string | undefined;
  return (
    <>
      {scripted && <input ref={hidden} type="hidden" name={name} value={value} readOnly />}
      {fallback && <noscript>{fallback}</noscript>}
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setQuery("");
        }}
      >
        <PopoverTrigger
          id={id}
          type="button"
          className={cn(
            "flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-2.5 text-left text-sm shadow-xs outline-none noscript:hidden md:h-9",
            "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
            value !== "" && "font-medium text-heading",
            className,
          )}
        >
          <span className="truncate">{current}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </PopoverTrigger>
        <PopoverContent>
          {searchable && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${noun}…`}
              aria-label={`Search ${noun}`}
              autoComplete="off"
              spellCheck={false}
              className="mb-1.5 h-11 w-full rounded-md border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9 md:text-sm"
            />
          )}
          <ul role="listbox" aria-label={noun} className="max-h-64 overflow-y-auto overscroll-contain">
            {rows.map((row) => {
              const heading = row.group && row.group !== lastGroup ? row.group : null;
              lastGroup = row.group;
              const selected = row.value === value;
              return (
                <li key={row.value || "__all"} role="presentation">
                  {heading && <p className="px-2 pt-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{heading}</p>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => choose(row.value)}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none md:min-h-9",
                      selected && "font-medium text-link",
                    )}
                  >
                    <span>{row.label}</span>
                    {selected && <Check className="size-4 shrink-0" aria-hidden />}
                  </button>
                </li>
              );
            })}
            {matches.length === 0 && <li className="px-2 py-3 text-center text-muted-foreground">No match.</li>}
          </ul>
        </PopoverContent>
      </Popover>
    </>
  );
}

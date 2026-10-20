"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface ChipLink {
  key: string;
  label: string;
  href: string;
  active: boolean;
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

// The row of chips. On a phone it scrolls sideways, so the chip in effect (which the words of the
// query may have selected) is scrolled into the row's view whenever it changes. Only the row
// moves, never the page.
export function ChipRow({ chips }: { chips: ChipLink[] }) {
  const list = useRef<HTMLUListElement>(null);
  const activeKey = chips.find((chip) => chip.active)?.key;

  useEffect(() => {
    const row = list.current;
    const active = row?.querySelector<HTMLElement>("[aria-current]");
    if (!row || !active) return;
    const rowBox = row.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    const margin = 16;
    if (box.right > rowBox.right) row.scrollLeft += box.right - rowBox.right + margin;
    else if (box.left < rowBox.left) row.scrollLeft -= rowBox.left - box.left + margin;
  }, [activeKey]);

  return (
    <nav aria-label="Result types" className="-mx-4">
      <ul ref={list} className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {chips.map((chip) => (
          <li key={chip.key} className="shrink-0">
            <Link
              href={chip.href}
              aria-current={chip.active ? "true" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors md:min-h-9",
                FOCUS,
                chip.active
                  ? "border-primary bg-primary font-semibold text-primary-foreground"
                  : "bg-card text-heading hover:border-primary/40 hover:bg-muted/60",
              )}
            >
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

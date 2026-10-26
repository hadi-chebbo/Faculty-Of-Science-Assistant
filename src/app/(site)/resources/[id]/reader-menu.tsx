"use client";

import { Bookmark, BookmarkCheck, Check, Download, ExternalLink, Maximize, MoreHorizontal, Minimize, MoveVertical, MoveHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Fragment, type Ref } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export interface ReaderMenuProps {
  id: string;
  // Desktop: a dropdown. Phone: a sheet from the bottom.
  sheet: boolean;
  fit: "width" | "page" | null;
  focus: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFit: (fit: "width" | "page") => void;
  onFocus: () => void;
  saved: boolean;
  onToggleSaved: () => void;
  triggerRef: Ref<HTMLButtonElement>;
}

// What the menu offers, once, for both presentations. Actions run in the page; links are plain
// `<a>` (not next/link): both targets are API routes that redirect to the file, and Link would
// prefetch them.
type Entry =
  | { kind: "action"; label: string; icon: LucideIcon; selected?: boolean; run: () => void }
  | { kind: "link"; label: string; icon: LucideIcon; href: string; newTab?: boolean };

function entriesOf({ id, fit, focus, onFit, onFocus, saved, onToggleSaved }: ReaderMenuProps): { group: Entry[] }[] {
  return [
    {
      group: [
        { kind: "action", label: "Fit width", icon: MoveHorizontal, selected: fit === "width", run: () => onFit("width") },
        { kind: "action", label: "Fit page", icon: MoveVertical, selected: fit === "page", run: () => onFit("page") },
        { kind: "action", label: focus ? "Exit focus mode" : "Focus mode", icon: focus ? Minimize : Maximize, run: onFocus },
      ],
    },
    {
      group: [
        {
          kind: "action",
          label: saved ? "Remove from saved" : "Save for later",
          icon: saved ? BookmarkCheck : Bookmark,
          run: onToggleSaved,
        },
        { kind: "link", label: "Download", icon: Download, href: `/api/v1/resources/${id}/download` },
        { kind: "link", label: "Open outside the reader", icon: ExternalLink, href: `/api/v1/resources/${id}/open`, newTab: true },
      ],
    },
  ];
}

const SHEET_ITEM =
  "flex h-12 w-full items-center gap-3 rounded-md px-4 text-left text-base text-heading outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50";

// The "⋯" button and what it opens.
export function ReaderMenu(props: ReaderMenuProps) {
  const { sheet, open, onOpenChange, triggerRef } = props;
  const groups = entriesOf(props);
  const trigger = (
    <Button ref={triggerRef} variant="ghost" size="icon" className="size-10" aria-label="More actions">
      <MoreHorizontal aria-hidden />
    </Button>
  );
  const newTabNote = <span className="sr-only">(opens in a new tab)</span>;

  if (sheet) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 rounded-t-2xl px-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="sr-only">
            <SheetTitle>More actions</SheetTitle>
            <SheetDescription>Zoom, focus mode, save for later, download and open outside the reader.</SheetDescription>
          </SheetHeader>
          <div aria-hidden className="mx-auto mt-2.5 mb-2 h-1 w-10 rounded-full bg-border" />
          {groups.map(({ group }, g) => (
            <div key={g} className="flex flex-col">
              {g > 0 && <div role="separator" className="mx-4 my-1.5 h-px bg-border" />}
              {group.map((entry) =>
                entry.kind === "link" ? (
                  <a key={entry.label} href={entry.href} {...(entry.newTab ? { target: "_blank", rel: "noopener" } : {})} className={SHEET_ITEM}>
                    <entry.icon aria-hidden className="size-4" />
                    {entry.label}
                    {entry.newTab && newTabNote}
                  </a>
                ) : (
                  <button
                    key={entry.label}
                    type="button"
                    aria-current={entry.selected || undefined}
                    className={SHEET_ITEM}
                    onClick={() => {
                      onOpenChange(false);
                      entry.run();
                    }}
                  >
                    <entry.icon aria-hidden className="size-4" />
                    <span className="flex-1">{entry.label}</span>
                    {entry.selected && <Check aria-hidden className="size-4" />}
                  </button>
                ),
              )}
            </div>
          ))}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {groups.map(({ group }, g) => (
          <Fragment key={g}>
            {g > 0 && <DropdownMenuSeparator />}
            {group.map((entry) =>
              entry.kind === "link" ? (
                <DropdownMenuItem key={entry.label} asChild>
                  <a href={entry.href} {...(entry.newTab ? { target: "_blank", rel: "noopener" } : {})}>
                    <entry.icon aria-hidden />
                    {entry.label}
                    {entry.newTab && newTabNote}
                  </a>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={entry.label} aria-current={entry.selected || undefined} onSelect={entry.run}>
                  <entry.icon aria-hidden />
                  <span className="flex-1">{entry.label}</span>
                  {entry.selected && <Check aria-hidden />}
                </DropdownMenuItem>
              ),
            )}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

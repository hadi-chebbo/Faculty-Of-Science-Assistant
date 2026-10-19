"use client";

import { Check, Download, ExternalLink, Maximize, MoreHorizontal, Minimize, MoveVertical, MoveHorizontal } from "lucide-react";
import type { Ref } from "react";
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
  triggerRef: Ref<HTMLButtonElement>;
}

const SHEET_ITEM =
  "flex h-12 w-full items-center gap-3 rounded-md px-4 text-left text-base text-heading outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50";

// The "⋯" button and what it opens. Download and Open outside are plain links (not next/link):
// both targets are API routes that redirect to the file, and Link would prefetch them.
export function ReaderMenu(props: ReaderMenuProps) {
  const { id, sheet, fit, focus, open, onOpenChange, onFit, onFocus, triggerRef } = props;
  const downloadHref = `/api/v1/resources/${id}/download`;
  const openHref = `/api/v1/resources/${id}/open`;
  const trigger = (
    <Button ref={triggerRef} variant="ghost" size="icon" className="size-10" aria-label="More actions">
      <MoreHorizontal aria-hidden />
    </Button>
  );
  const focusLabel = focus ? "Exit focus mode" : "Focus mode";
  const FocusIcon = focus ? Minimize : Maximize;

  if (sheet) {
    const done = (action?: () => void) => () => {
      onOpenChange(false);
      action?.();
    };
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 rounded-t-2xl px-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="sr-only">
            <SheetTitle>More actions</SheetTitle>
            <SheetDescription>Zoom, focus mode, download and open outside the reader.</SheetDescription>
          </SheetHeader>
          <div aria-hidden className="mx-auto mt-2.5 mb-2 h-1 w-10 rounded-full bg-border" />
          <button type="button" aria-current={fit === "width" || undefined} className={SHEET_ITEM} onClick={done(() => onFit("width"))}>
            <MoveHorizontal aria-hidden className="size-4" />
            <span className="flex-1">Fit width</span>
            {fit === "width" && <Check aria-hidden className="size-4" />}
          </button>
          <button type="button" aria-current={fit === "page" || undefined} className={SHEET_ITEM} onClick={done(() => onFit("page"))}>
            <MoveVertical aria-hidden className="size-4" />
            <span className="flex-1">Fit page</span>
            {fit === "page" && <Check aria-hidden className="size-4" />}
          </button>
          <button type="button" className={SHEET_ITEM} onClick={done(onFocus)}>
            <FocusIcon aria-hidden className="size-4" />
            {focusLabel}
          </button>
          <div role="separator" className="mx-4 my-1.5 h-px bg-border" />
          <a href={downloadHref} className={SHEET_ITEM}>
            <Download aria-hidden className="size-4" />
            Download
          </a>
          <a href={openHref} target="_blank" rel="noopener" className={SHEET_ITEM}>
            <ExternalLink aria-hidden className="size-4" />
            Open outside the reader
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem aria-current={fit === "width" || undefined} onSelect={() => onFit("width")}>
          <MoveHorizontal aria-hidden />
          <span className="flex-1">Fit width</span>
          {fit === "width" && <Check aria-hidden />}
        </DropdownMenuItem>
        <DropdownMenuItem aria-current={fit === "page" || undefined} onSelect={() => onFit("page")}>
          <MoveVertical aria-hidden />
          <span className="flex-1">Fit page</span>
          {fit === "page" && <Check aria-hidden />}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onFocus}>
          <FocusIcon aria-hidden />
          {focusLabel}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={downloadHref}>
            <Download aria-hidden />
            Download
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={openHref} target="_blank" rel="noopener">
            <ExternalLink aria-hidden />
            Open outside the reader
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

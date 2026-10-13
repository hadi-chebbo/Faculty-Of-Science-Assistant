"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

// One chapter row that can be dragged by its handle. `children` receives the handle (null while
// the row is being renamed) so the row can place it at the start of its own layout.
export function SortableChapterItem({
  id,
  title,
  disabled,
  showHandle,
  children,
}: {
  id: string;
  title: string;
  disabled: boolean;
  showHandle: boolean;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const handle = showHandle ? (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      disabled={disabled}
      aria-label={`Reorder ${title}`}
      className="inline-flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-heading focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50 md:size-9"
    >
      <GripVertical aria-hidden className="size-5" />
    </button>
  ) : null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`rounded-lg border bg-card p-3 motion-reduce:transition-none! ${
        isDragging ? "relative z-10 shadow-xl ring-2 ring-primary" : ""
      }`}
    >
      {children(handle)}
    </li>
  );
}

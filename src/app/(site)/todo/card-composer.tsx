"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TODO_TITLE_MAX_LENGTH, type TodoStatus } from "@/db/constants";
import { STATUS_LOOK } from "./todo-status";

// The small form that adds a card to one column. Enter adds the card and keeps the form open for
// the next one; an empty title does nothing; Esc or Cancel closes it.
export function CardComposer({
  status,
  onAdd,
  onClose,
}: {
  status: TodoStatus;
  onAdd: (status: TodoStatus, title: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");

  return (
    <form
      className="rounded-xl border bg-card p-2 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = title.trim();
        if (!trimmed) return;
        onAdd(status, trimmed);
        setTitle("");
      }}
    >
      <Input
        autoFocus
        value={title}
        maxLength={TODO_TITLE_MAX_LENGTH}
        placeholder="What do you want to do?"
        aria-label={`New card in ${STATUS_LOOK[status].label}`}
        className="h-11 md:h-9"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      />
      <div className="mt-2 flex items-center gap-1">
        <Button type="submit" size="sm" className="h-11 md:h-8">
          Add card
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-11 md:h-8" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

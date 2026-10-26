"use client";

import { Bookmark, X } from "lucide-react";
import { useRef, useState } from "react";
import { TYPE_ICONS } from "@/components/site/resource-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TODO_TITLE_MAX_LENGTH, type TodoStatus } from "@/db/constants";
import { SavedFilePicker, type PickedFile } from "./saved-file-picker";
import { STATUS_LOOK } from "./todo-status";

// The small form that adds a card to one column. Enter adds the card and keeps the form open for
// the next one; an empty title does nothing (unless a saved file is linked: the card then takes
// the file's title); Esc or Cancel closes it, and Esc with the file picker open closes only the picker.
export function CardComposer({
  status,
  onAdd,
  onClose,
}: {
  status: TodoStatus;
  onAdd: (status: TodoStatus, title: string, file: PickedFile | null) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [picking, setPicking] = useState(false);
  const linkButton = useRef<HTMLButtonElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const FileIcon = file ? TYPE_ICONS[file.type] : null;

  return (
    <form
      className="rounded-xl border bg-card p-2 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = title.trim();
        if (!trimmed && !file) return;
        onAdd(status, trimmed, file);
        setTitle("");
        setFile(null);
        setPicking(false);
      }}
    >
      <Input
        ref={titleInput}
        autoFocus
        value={title}
        maxLength={TODO_TITLE_MAX_LENGTH}
        placeholder={file?.title ?? "What do you want to do?"}
        aria-label={`New card in ${STATUS_LOOK[status].label}`}
        className="h-11 md:h-9"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            // With the picker open, Esc closes only the picker (its own listener does that).
            if (!picking) onClose();
          }
        }}
      />
      {file && FileIcon && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border bg-muted/40 py-1 pr-1 pl-2 text-sm">
          <FileIcon className="size-4 shrink-0 text-link" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{file.title}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 md:size-8"
            aria-label={`Remove ${file.title}`}
            onClick={() => {
              setFile(null);
              setTimeout(() => linkButton.current?.focus());
            }}
          >
            <X aria-hidden />
          </Button>
        </div>
      )}
      {!file && (
        <Button
          ref={linkButton}
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={picking}
          className="mt-1 h-11 text-link md:h-8"
          onClick={() => setPicking((open) => !open)}
        >
          <Bookmark aria-hidden /> Link a saved file
        </Button>
      )}
      {picking && !file && (
        <SavedFilePicker
          onClose={() => {
            setPicking(false);
            setTimeout(() => linkButton.current?.focus());
          }}
          onPick={(picked) => {
            setFile(picked);
            setPicking(false);
            setTimeout(() => titleInput.current?.focus());
          }}
        />
      )}
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

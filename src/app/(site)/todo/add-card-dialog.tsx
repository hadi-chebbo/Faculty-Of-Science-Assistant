"use client";

import { Bookmark, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TODO_NOTE_MAX_LENGTH, TODO_STATUSES, TODO_TITLE_MAX_LENGTH, type TodoStatus } from "@/db/constants";
import { TYPE_ICONS } from "@/lib/design-language";
import { useHydrated } from "@/lib/use-hydrated";
import { SavedFilePicker, type PickedFile } from "./saved-file-picker";
import { STATUS_LOOK } from "./todo-status";

const NEAR_LIMIT = Math.floor(TODO_NOTE_MAX_LENGTH * 0.9);

// A card needs a title, unless a saved file is linked (the card then takes the file's title).
export const canAddCard = (title: string, file: PickedFile | null) => title.trim().length > 0 || file !== null;

type OnAdd = (status: TodoStatus, title: string, file: PickedFile | null, note: string) => void;

// The new-card form: one dialog owned by the board (a full-screen sheet on a phone). `status` is the
// column it was opened for and preselects the Column choice. Add card hands the card to `onAdd` and
// the board closes it; Esc or Cancel close it, and Esc with the file picker open closes only the picker.
export function AddCardDialog({
  open,
  status,
  onAdd,
  onClose,
  onCloseFocus,
}: {
  open: boolean;
  status: TodoStatus;
  onAdd: OnAdd;
  onClose: () => void;
  onCloseFocus: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          // Esc closes an open file picker first, and only that.
          if (document.querySelector("[data-saved-picker]")) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseFocus();
        }}
        className="motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none inset-0 flex max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none p-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[92vh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
      >
        {open && <AddCardForm initialStatus={status} onAdd={onAdd} />}
      </DialogContent>
    </Dialog>
  );
}

function AddCardForm({ initialStatus, onAdd }: { initialStatus: TodoStatus; onAdd: OnAdd }) {
  const hydrated = useHydrated();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [status, setStatus] = useState<TodoStatus>(initialStatus);
  const [picking, setPicking] = useState(false);
  const linkButton = useRef<HTMLButtonElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const FileIcon = file ? TYPE_ICONS[file.type] : null;
  const look = STATUS_LOOK[status];

  return (
    <form
      method="post"
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canAddCard(title, file)) return;
        onAdd(status, title.trim(), file, note);
      }}
    >
      <div className={`h-1.5 w-full shrink-0 ${look.bar}`} aria-hidden />
      <DialogClose asChild>
        <Button type="button" variant="ghost" className="absolute top-3 right-3 size-11 sm:top-4 sm:right-4 sm:size-8" aria-label="Close">
          <X aria-hidden />
        </Button>
      </DialogClose>
      <div className="flex flex-col gap-5 p-5 pt-14 sm:pt-5 md:p-6">
        <DialogTitle className="text-xl font-semibold text-heading">New card</DialogTitle>
        <DialogDescription className="sr-only">Add a card to your to-do board.</DialogDescription>

        <div>
          <label htmlFor="new-card-title" className="mb-2 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Title
          </label>
          <Input
            ref={titleInput}
            id="new-card-title"
            autoFocus
            value={title}
            maxLength={TODO_TITLE_MAX_LENGTH}
            placeholder={file?.title ?? "What do you want to do?"}
            className="h-11 md:h-9"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="new-card-note" className="mb-2 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Note (optional)
          </label>
          <Textarea
            id="new-card-note"
            value={note}
            rows={4}
            maxLength={TODO_NOTE_MAX_LENGTH}
            placeholder="Add details: pages, questions to ask…"
            aria-describedby="new-card-note-count"
            onChange={(event) => setNote(event.target.value)}
          />
          <p id="new-card-note-count" className={`mt-1 text-right text-xs ${note.length >= NEAR_LIMIT ? "font-medium text-heading" : "text-muted-foreground"}`}>
            {note.length} / {TODO_NOTE_MAX_LENGTH}
          </p>
        </div>

        <div>
          {file && FileIcon ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 py-1 pr-1 pl-2 text-sm">
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
          ) : (
            <Button
              ref={linkButton}
              type="button"
              variant="outline"
              className="h-11 w-full justify-start md:h-9"
              aria-expanded={picking}
              onClick={() => setPicking((isOpen) => !isOpen)}
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
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Column</legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {TODO_STATUSES.map((value) => {
              const option = STATUS_LOOK[value];
              const Icon = option.icon;
              return (
                <label
                  key={value}
                  className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-1 text-sm text-muted-foreground has-checked:bg-card has-checked:font-semibold has-checked:text-heading has-checked:ring-1 has-checked:ring-border has-focus-visible:ring-2 has-focus-visible:ring-ring md:h-9"
                >
                  <input type="radio" name="status" value={value} checked={status === value} onChange={() => setStatus(value)} className="sr-only" />
                  <Icon className={`size-4 shrink-0 ${option.iconTone}`} aria-hidden />
                  <span className="truncate">{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost" className="h-11 md:h-9">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" className="h-11 md:h-9" disabled={!hydrated || !canAddCard(title, file)}>
            Add card
          </Button>
        </div>
      </div>
    </form>
  );
}

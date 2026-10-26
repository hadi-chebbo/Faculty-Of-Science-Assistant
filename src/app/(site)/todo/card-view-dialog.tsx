"use client";

import { Check, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TODO_NOTE_MAX_LENGTH, TODO_STATUSES, TODO_TITLE_MAX_LENGTH, type TodoStatus } from "@/db/constants";
import { relativeTime } from "@/lib/relative-time";
import { titleOf, type BoardCard } from "./todo-card";
import { STATUS_LOOK } from "./todo-status";
import type { Edit, SaveInfo } from "./use-card-saver";

// The note counter turns up as a warning only near the limit.
const NEAR_LIMIT = Math.floor(TODO_NOTE_MAX_LENGTH * 0.9);

function saveLine(info: SaveInfo | undefined): { text: string; tone: string } {
  switch (info?.status) {
    case "saving":
      return { text: "Saving…", tone: "text-muted-foreground" };
    case "saved":
      return { text: "Saved", tone: "text-muted-foreground" };
    case "retrying":
      return { text: "Couldn't save, retrying", tone: "text-destructive" };
    case "failed":
      return { text: "Couldn't save. Check your connection and edit again.", tone: "text-destructive" };
    case "invalid":
      return { text: "Not saved yet", tone: "text-destructive" };
    default:
      return { text: "Changes are saved as you type.", tone: "text-muted-foreground" };
  }
}

// The card view (like a Jira issue): one dialog owned by the board, whichever card is open. Title and
// note save as you type (no Save button); the status is a list of the three columns, and choosing
// one moves the card to the top of it while the card view stays open.
export function CardViewDialog({
  card,
  now,
  info,
  onEdit,
  onClose,
  onDelete,
  onMove,
  onCloseFocus,
}: {
  card: BoardCard | null;
  now: string;
  info: SaveInfo | undefined;
  onEdit: (id: string, change: Edit) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: TodoStatus) => void;
  onCloseFocus: () => void;
}) {
  return (
    <Dialog open={card !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseFocus();
        }}
        className="inset-0 flex max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none p-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[92vh] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
      >
        {card && <CardViewBody key={card.id} card={card} now={now} info={info} onEdit={onEdit} onDelete={onDelete} onMove={onMove} />}
      </DialogContent>
    </Dialog>
  );
}

function CardViewBody({
  card,
  now,
  info,
  onEdit,
  onDelete,
  onMove,
}: {
  card: BoardCard;
  now: string;
  info: SaveInfo | undefined;
  onEdit: (id: string, change: Edit) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: TodoStatus) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const look = STATUS_LOOK[card.status];
  const line = saveLine(info);
  const titleInvalid = info?.invalidFields.includes("title") ?? false;
  const noteInvalid = info?.invalidFields.includes("note") ?? false;
  const unsafe = info?.status === "retrying" || info?.status === "failed";

  return (
    <>
      <div className={`h-1.5 w-full shrink-0 ${look.bar}`} aria-hidden />
      <DialogClose asChild>
        <Button variant="ghost" className="absolute top-3 right-3 size-11 sm:top-4 sm:right-4 sm:size-8" aria-label="Close">
          <X aria-hidden />
        </Button>
      </DialogClose>
      <DialogTitle className="sr-only">Card: {titleOf(card)}</DialogTitle>
      <DialogDescription className="sr-only">Edit this card. Changes are saved as you type.</DialogDescription>

      <div className="grid flex-1 md:grid-cols-[1fr_15rem]">
        <div className="flex flex-col gap-5 p-5 pt-14 sm:pt-5 md:p-6">
          <div>
            <label htmlFor="card-title" className="sr-only">
              Title
            </label>
            <Textarea
              id="card-title"
              value={card.title}
              rows={1}
              maxLength={TODO_TITLE_MAX_LENGTH}
              placeholder="What do you want to do?"
              aria-invalid={titleInvalid || undefined}
              aria-describedby={titleInvalid ? "card-title-error" : undefined}
              onChange={(event) => onEdit(card.id, { title: event.target.value.replace(/\s*\n\s*/g, " ") })}
              onKeyDown={(event) => {
                // The title is one line: Enter moves on to the note.
                if (event.key === "Enter") {
                  event.preventDefault();
                  document.getElementById("card-note")?.focus();
                }
              }}
              className="min-h-0 resize-none border-0 px-0 text-xl font-semibold text-heading shadow-none focus-visible:ring-0 md:text-2xl"
            />
            {titleInvalid && (
              <p id="card-title-error" className="mt-1 text-sm text-destructive">
                A card needs a title.
              </p>
            )}
            <p id="card-save-status" className={`mt-1 text-xs ${line.tone}`} aria-hidden>
              {line.text}
            </p>
            {/* Only problems are announced; "Saving…" and "Saved" would chatter while typing. */}
            <p role="status" className="sr-only">
              {unsafe ? line.text : ""}
            </p>
          </div>

          <section>
            <label htmlFor="card-note" className="mb-2 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Note
            </label>
            <Textarea
              id="card-note"
              value={card.note}
              rows={5}
              maxLength={TODO_NOTE_MAX_LENGTH}
              placeholder="Add details: pages, questions to ask, what went wrong last time…"
              aria-invalid={noteInvalid || undefined}
              aria-describedby="card-note-count"
              onChange={(event) => onEdit(card.id, { note: event.target.value })}
            />
            <p
              id="card-note-count"
              className={`mt-1 text-right text-[11px] ${card.note.length >= NEAR_LIMIT ? "font-medium text-heading" : "text-muted-foreground"}`}
            >
              {card.note.length} / {TODO_NOTE_MAX_LENGTH}
            </p>
          </section>
        </div>

        <aside className="flex flex-col gap-5 border-t bg-muted/40 p-5 md:border-t-0 md:border-l">
          <section>
            <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Status</h4>
            <div role="group" aria-label="Status" className="flex flex-col gap-1">
              {TODO_STATUSES.map((status) => {
                const option = STATUS_LOOK[status];
                const Icon = option.icon;
                const current = status === card.status;
                return (
                  <Button
                    key={status}
                    type="button"
                    variant="ghost"
                    aria-pressed={current}
                    disabled={card.pending}
                    onClick={() => !current && onMove(card.id, status)}
                    className={`h-11 justify-start gap-2 px-2 md:h-9 ${current ? "bg-card font-semibold text-heading ring-1 ring-border" : "text-muted-foreground"}`}
                  >
                    <Icon className={`size-4 ${option.iconTone}`} aria-hidden />
                    {option.label}
                    {current && <Check className="ml-auto size-4" aria-hidden />}
                  </Button>
                );
              })}
            </div>
          </section>
          <section>
            <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Details</h4>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">Added</dt>
              <dd>{relativeTime(card.createdAt, now)}</dd>
              <dt className="text-muted-foreground">In this column since</dt>
              <dd>{relativeTime(card.statusChangedAt, now)}</dd>
            </dl>
          </section>
          <div className="md:mt-auto">
            {confirming ? (
              <div className="flex flex-col gap-2" role="group" aria-label="Confirm delete">
                <p className="text-sm">Delete this card?</p>
                <div className="flex gap-2">
                  <Button variant="destructive" autoFocus className="h-11 flex-1 md:h-9" onClick={() => onDelete(card.id)}>
                    Delete
                  </Button>
                  <Button variant="outline" className="h-11 md:h-9" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" className="h-11 w-full justify-start text-destructive md:h-9" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden /> Delete card
              </Button>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

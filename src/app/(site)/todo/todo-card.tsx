import { ArrowDown, ArrowUp, Check, Clock, MoreHorizontal, PencilLine, Play, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TODO_STATUSES, type TodoStatus } from "@/db/constants";
import { relativeTime } from "@/lib/relative-time";
import type { TodoCard as Card } from "@/services/todos/types";
import { STATUS_LOOK } from "./todo-status";

export const DONE_MESSAGE = "Nice, that's done.";

// The message of the Undo toast after a card moved to a column.
export const moveMessage = (status: TodoStatus) => (status === "done" ? DONE_MESSAGE : `Moved to ${STATUS_LOOK[status].label}`);

// How a move was asked for: the Undo message, and whether the focus stays where it is (the card
// view) instead of following the card to its new place.
export type MoveHow = { message: string; keepFocus?: boolean };

// A card still being saved (the optimistic copy) is shown slightly faded.
export type BoardCard = Card & { pending?: boolean };

// A card that has neither title nor file cannot be created yet; when linked files arrive a card
// may have no title of its own.
export const titleOf = (card: Card) => card.title || "Untitled";

// One card: the note icon, the title, a two-line note preview and when it was added (or, in Done,
// when it was finished). `now` comes from the board so server and browser agree.
// Start (To do) and Done (In progress) move the card to the top of the next column; the "…" menu
// moves it to either other column, up or down. `index` and `count` say where it stands in its column.
// The title is a button stretched over the whole card (an overlay), so the card opens with a click
// or Enter/Space without nesting controls; the "…" menu sits above that overlay. A card that is
// still being created can be neither opened nor changed.
export function TodoCardView({
  card,
  now,
  index,
  count,
  celebrating,
  onOpen,
  onDelete,
  onMove,
}: {
  card: BoardCard;
  now: string;
  index: number;
  count: number;
  celebrating: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: TodoStatus, index: number, how: MoveHow) => void;
}) {
  const done = card.status === "done";
  return (
    <article
      aria-busy={card.pending || undefined}
      className={`relative rounded-xl border bg-card p-3 text-left shadow-xs transition-opacity hover:border-foreground/20 ${card.pending ? "opacity-70" : ""} ${done ? "bg-card/70" : ""} ${celebrating ? "done-ring" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-link" aria-hidden>
          <StickyNote className="size-4" />
        </span>
        <span className="text-xs text-muted-foreground">Note</span>
      </div>

      <h3
        className={`mt-2 pr-11 text-sm font-medium leading-snug break-words md:pr-8 ${done ? "text-muted-foreground line-through decoration-success/70 decoration-2" : "text-heading"}`}
      >
        {card.pending ? (
          titleOf(card)
        ) : (
          <button
            type="button"
            data-card-open={card.id}
            aria-haspopup="dialog"
            onClick={() => onOpen(card.id)}
            className="cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            {titleOf(card)}
          </button>
        )}
      </h3>
      {card.note && (
        <p className="mt-1.5 line-clamp-2 border-l-2 border-muted pl-2 text-xs leading-relaxed text-muted-foreground">{card.note}</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="size-3" aria-hidden />
          {done ? "Done" : "Added"} {relativeTime(done ? card.statusChangedAt : card.createdAt, now)}
        </span>
        <span className="flex-1" />
        {!card.pending && card.status === "todo" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="relative z-10 h-11 gap-1.5 rounded-full px-4 text-xs md:h-8 md:px-3"
            onClick={() => onMove(card.id, "in_progress", 0, { message: "Moved to In progress" })}
          >
            <Play className="size-3.5" aria-hidden /> Start
          </Button>
        )}
        {!card.pending && card.status === "in_progress" && (
          <Button
            type="button"
            size="sm"
            className="relative z-10 h-11 gap-1.5 rounded-full bg-success px-4 text-xs text-success-foreground hover:bg-success/90 md:h-8 md:px-3"
            onClick={() => onMove(card.id, "done", 0, { message: DONE_MESSAGE })}
          >
            <Check className="size-3.5" aria-hidden /> Done
          </Button>
        )}
        {done && (
          <span
            className={`flex size-6 items-center justify-center rounded-full bg-success text-success-foreground ${celebrating ? "done-check" : ""}`}
            role="img"
            aria-label="Done"
          >
            <Check className="size-3.5" aria-hidden />
          </span>
        )}
      </div>

      {/* Last in the DOM, so Tab reaches the card before its menu; drawn above the title's overlay. */}
      {!card.pending && (
        <div className="absolute top-1 right-1 z-10 md:top-2 md:right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Actions for ${titleOf(card)}`}
                className="size-11 text-muted-foreground md:size-8"
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {TODO_STATUSES.filter((status) => status !== card.status).map((status) => {
                const look = STATUS_LOOK[status];
                const Icon = look.icon;
                return (
                  <DropdownMenuItem
                    key={status}
                    className="min-h-11 md:min-h-8"
                    onSelect={() => onMove(card.id, status, 0, { message: moveMessage(status) })}
                  >
                    <Icon className={look.iconTone} aria-hidden /> {look.label}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-11 md:min-h-8"
                disabled={index === 0}
                onSelect={() => onMove(card.id, card.status, index - 1, { message: "Moved up" })}
              >
                <ArrowUp aria-hidden /> Move up
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11 md:min-h-8"
                disabled={index >= count - 1}
                onSelect={() => onMove(card.id, card.status, index + 1, { message: "Moved down" })}
              >
                <ArrowDown aria-hidden /> Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="min-h-11 md:min-h-8" onSelect={() => onOpen(card.id)}>
                <PencilLine aria-hidden /> Open card
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" className="min-h-11 md:min-h-8" onSelect={() => onDelete(card.id)}>
                <Trash2 aria-hidden /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </article>
  );
}

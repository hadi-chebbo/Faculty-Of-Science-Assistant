import { memo, useRef, type HTMLAttributes, type Ref } from "react";
import { ArrowDown, ArrowUp, Check, ChevronRight, Clock, FileX, MoreHorizontal, PencilLine, Play, StickyNote, Trash2 } from "lucide-react";
import Link from "next/link";
import { TYPE_ICONS } from "@/components/site/resource-row";
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
import { RESOURCE_TYPE_SINGULAR_LABELS } from "@/lib/labels";
import { relativeTime } from "@/lib/relative-time";
import type { TodoCard as Card } from "@/services/todos/types";
import { STATUS_LOOK } from "./todo-status";

export const DONE_MESSAGE = "Nice, that's done.";

// The message of the Undo toast after a card moved to a column.
export const moveMessage = (status: TodoStatus) => (status === "done" ? DONE_MESSAGE : `Moved to ${STATUS_LOOK[status].label}`);

// How a move was asked for: the Undo message, and whether the focus stays where it is (the card
// view) instead of following the card to its new place.
export type MoveHow = { message: string; keepFocus?: boolean };

// What a sortable card hands to its title button on desktop: the drag attributes (screen-reader
// role description and instructions) and the ref that makes the button the keyboard activator.
export type CardDrag = { attributes: HTMLAttributes<HTMLElement>; activatorRef: Ref<HTMLButtonElement> };

// A card still being saved (the optimistic copy) is shown slightly faded.
export type BoardCard = Card & { pending?: boolean };

export const FILE_UNAVAILABLE = "This file is no longer available";

// The card's own title, else its file's title; a file that is no longer published never lends its
// title. No file left (it was deleted) and no title: "A file that was removed".
export const titleOf = (card: Card) =>
  card.title || (card.resource?.available ? card.resource.title : card.resource ? FILE_UNAVAILABLE : "A file that was removed");

// The board is drawn twice (phone tabs and desktop columns, one hidden by CSS), so a control is
// looked up among the copies that are on screen.
export function visibleElement(selector: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>(selector)].find((el) => el.getClientRects().length > 0);
}

// After a move: the focus follows the card. On a phone the card may have left the tab that is on
// screen (one column at a time); then the selected tab keeps the focus.
export function focusMovedCard(id: string) {
  (visibleElement(`[data-card-open="${id}"]`) ?? visibleElement('[role="tab"][aria-selected="true"]'))?.focus();
}

// One card: the note icon, the title, a two-line note preview and when it was added (or, in Done,
// when it was finished). `now` comes from the board so server and browser agree.
// Start (To do) and Done (In progress) move the card to the top of the next column; the "…" menu
// moves it to either other column, up or down. `index` and `count` say where it stands in its column.
// The title is a button stretched over the whole card (an overlay), so the card opens with a click
// or Enter/Space without nesting controls; the "…" menu sits above that overlay. A card that is
// still being created can be neither opened nor changed.
// Memoised: while a card is dragged, dnd-kit re-renders every sortable item on each pointer move,
// and the props here stay the same unless the card itself changed.
export const TodoCardView = memo(function TodoCardView({
  card,
  now,
  index,
  count,
  celebrating,
  onOpen,
  onDelete,
  onMove,
  drag,
  overlay = false,
}: {
  card: BoardCard;
  now: string;
  index: number;
  count: number;
  celebrating: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: TodoStatus, index: number, how: MoveHow) => void;
  drag?: CardDrag;
  // The copy that follows the pointer while dragging: no title button, so nothing is found twice.
  overlay?: boolean;
}) {
  const done = card.status === "done";
  const file = card.resource;
  // After a move from the menu the board puts the focus on the card in its new place, so the menu
  // must not pull it back to its button.
  const moved = useRef(false);
  const moveFromMenu = (status: TodoStatus, to: number, message: string) => {
    moved.current = true;
    onMove(card.id, status, to, { message });
  };
  return (
    <article
      data-card-drag={drag ? "" : undefined}
      aria-busy={card.pending || undefined}
      className={`relative rounded-xl border bg-card p-3 text-left shadow-xs transition-opacity hover:border-foreground/20 ${card.pending ? "opacity-70" : ""} ${done ? "bg-card/70" : ""} ${celebrating ? "done-ring" : ""}`}
    >
      {/* A card with a file shows it in its own tile below; only a plain note keeps this label. */}
      {!file && (
        <div className="mb-2 flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden>
            <StickyNote className="size-4" />
          </span>
          <span className="text-xs text-muted-foreground">Note</span>
        </div>
      )}

      <h3
        className={`pr-11 text-sm font-medium leading-snug break-words md:pr-8 ${done ? "text-muted-foreground line-through decoration-success/70 decoration-2" : "text-heading"}`}
      >
        {card.pending || overlay ? (
          titleOf(card)
        ) : (
          <button
            type="button"
            data-card-open={card.id}
            ref={drag?.activatorRef}
            {...drag?.attributes}
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
      {file && (file.available || card.title) && <FileTile file={file} cardTitle={card.title} live={!card.pending && !overlay} />}

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
      {!card.pending && !overlay && (
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
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={(event) => {
                if (moved.current) {
                  // The menu has just left the page; only now is the focus safe. Handing it to the
                  // card earlier loses it to the closing menu, which grabs it back while it fades out.
                  event.preventDefault();
                  focusMovedCard(card.id);
                }
                moved.current = false;
              }}
            >
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {TODO_STATUSES.filter((status) => status !== card.status).map((status) => {
                const look = STATUS_LOOK[status];
                const Icon = look.icon;
                return (
                  <DropdownMenuItem
                    key={status}
                    className="min-h-11 md:min-h-8"
                    onSelect={() => moveFromMenu(status, 0, moveMessage(status))}
                  >
                    <Icon className={look.iconTone} aria-hidden /> {look.label}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-11 md:min-h-8"
                disabled={index === 0}
                onSelect={() => moveFromMenu(card.status, index - 1, "Moved up")}
              >
                <ArrowUp aria-hidden /> Move up
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11 md:min-h-8"
                disabled={index >= count - 1}
                onSelect={() => moveFromMenu(card.status, index + 1, "Moved down")}
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
});

// The linked file, shown like an attachment: its type icon, its title and course, and Open. The
// whole tile is the link to the reader (same tab), drawn above the title's overlay so it is its own
// click target; a press on it never starts a drag. When the card has no title of its own, the
// heading already is the file's title, so the tile leads with the course and type instead.
// A file that is no longer published shows a muted tile with no title and no link. A card still
// being created, or the copy that follows the pointer, draws the tile without the link.
function FileTile({ file, cardTitle, live }: { file: NonNullable<Card["resource"]>; cardTitle: string; live: boolean }) {
  if (!file.available) {
    return (
      <div className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-dashed bg-muted/40 p-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden>
          <FileX className="size-4" />
        </span>
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">{FILE_UNAVAILABLE}</p>
      </div>
    );
  }
  const Icon = TYPE_ICONS[file.type];
  const meta = (
    <span className="text-[11px] text-muted-foreground">
      <span className="font-mono font-medium text-link">{file.courseCode}</span> · {RESOURCE_TYPE_SINGULAR_LABELS[file.type]}
    </span>
  );
  const body = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-link" aria-hidden>
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        {cardTitle ? (
          <>
            <span className="truncate text-xs font-medium text-heading">{file.title}</span>
            {meta}
          </>
        ) : (
          meta
        )}
      </span>
      <span className="inline-flex shrink-0 items-center gap-0.5 pr-1 text-xs font-medium text-link" aria-hidden>
        Open <ChevronRight className="size-3.5" />
      </span>
    </>
  );
  const look = "mt-2.5 flex min-h-11 items-center gap-2.5 rounded-lg border bg-muted/40 p-2 md:min-h-0";
  if (!live) return <div className={look}>{body}</div>;
  return (
    <Link
      href={`/resources/${file.id}`}
      aria-label={`Open ${file.title} in the reader`}
      className={`${look} relative z-10 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none`}
    >
      {body}
    </Link>
  );
}

// The friendly empty text of a column with no cards.
// While a filter is on, an empty column says that nothing matches instead.
export function ColumnEmpty({ status, filtered = false }: { status: TodoStatus; filtered?: boolean }) {
  const look = STATUS_LOOK[status];
  const Icon = look.icon;
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border/80 px-4 py-8 text-center">
      <Icon className={`size-6 ${look.iconTone} opacity-60`} aria-hidden />
      <p className="text-xs text-muted-foreground">{filtered ? "No cards match" : look.empty}</p>
    </div>
  );
}

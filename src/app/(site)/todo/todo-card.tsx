import { Check, Clock, MoreHorizontal, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { relativeTime } from "@/lib/relative-time";
import type { TodoCard as Card } from "@/services/todos/types";

// A card still being saved (the optimistic copy) is shown slightly faded.
export type BoardCard = Card & { pending?: boolean };

// A card that has neither title nor file cannot be created yet; when linked files arrive a card
// may have no title of its own.
export const titleOf = (card: Card) => card.title || "Untitled";

// One card: the note icon, the title, a two-line note preview and when it was added (or, in Done,
// when it was finished). `now` comes from the board so server and browser agree.
// The title is a button stretched over the whole card (an overlay), so the card opens with a click
// or Enter/Space without nesting controls; the "…" menu sits above that overlay. A card that is
// still being created can be neither opened nor changed.
export function TodoCardView({
  card,
  now,
  onOpen,
  onDelete,
}: {
  card: BoardCard;
  now: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const done = card.status === "done";
  return (
    <article
      aria-busy={card.pending || undefined}
      className={`relative rounded-xl border bg-card p-3 text-left shadow-xs transition-opacity hover:border-foreground/20 ${card.pending ? "opacity-70" : ""} ${done ? "bg-card/70" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-link" aria-hidden>
          <StickyNote className="size-4" />
        </span>
        <span className="text-xs text-muted-foreground">Note</span>
        <span className="flex-1" />
        {!card.pending && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Actions for ${titleOf(card)}`}
                className="relative z-10 -my-2 -mr-1.5 size-11 text-muted-foreground md:-my-1 md:size-8"
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* "Move to…" joins this menu with the moving tickets. */}
              <DropdownMenuItem variant="destructive" className="min-h-11 md:min-h-8" onSelect={() => onDelete(card.id)}>
                <Trash2 aria-hidden /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <h3
        className={`mt-2 text-sm font-medium leading-snug break-words ${done ? "text-muted-foreground line-through decoration-success/70 decoration-2" : "text-heading"}`}
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
        {done && (
          <span className="flex size-6 items-center justify-center rounded-full bg-success text-success-foreground" role="img" aria-label="Done">
            <Check className="size-3.5" aria-hidden />
          </span>
        )}
      </div>
    </article>
  );
}

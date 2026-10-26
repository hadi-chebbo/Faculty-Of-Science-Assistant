import { Check, Clock, StickyNote } from "lucide-react";
import { relativeTime } from "@/lib/relative-time";
import type { TodoCard as Card } from "@/services/todos/types";

// A card still being saved (the optimistic copy) is shown slightly faded.
export type BoardCard = Card & { pending?: boolean };

// A card that has neither title nor file cannot be created yet; when linked files arrive a card
// may have no title of its own.
const titleOf = (card: Card) => card.title || "Untitled";

// One card: the note icon, the title, a two-line preview of the note and when it was added (or,
// in Done, when it was finished). `now` comes from the board so server and browser agree.
export function TodoCardView({ card, now }: { card: BoardCard; now: string }) {
  const done = card.status === "done";
  return (
    <article
      aria-busy={card.pending || undefined}
      className={`rounded-xl border bg-card p-3 text-left shadow-xs transition-opacity ${card.pending ? "opacity-70" : ""} ${done ? "bg-card/70" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-link" aria-hidden>
          <StickyNote className="size-4" />
        </span>
        <span className="text-xs text-muted-foreground">Note</span>
      </div>

      <h3
        className={`mt-2 text-sm font-medium leading-snug break-words ${done ? "text-muted-foreground line-through decoration-success/70 decoration-2" : "text-heading"}`}
      >
        {titleOf(card)}
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

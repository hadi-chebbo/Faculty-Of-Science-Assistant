"use client";

// PROTOTYPE ONLY (branch prototype/todo-board). Never merge to main.
// Question: what should the to-do board look like on desktop and on a phone?
// Three variants of /todo, switchable with ?variant=A|B|C. Data is fake and lives in memory.
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Check,
  ChevronDown,
  CircleDot,
  FileText,
  GripVertical,
  MoreHorizontal,
  Play,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { PageTitle } from "@/components/site/page-title";
import { PrototypeSwitcher } from "@/components/prototype-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useRichBoard, VariantD, VariantE } from "./rich-board";

// ---------- fake data ----------

type Status = "todo" | "in_progress" | "done";
type LinkedResource = { id: string; title: string; courseCode: string; type: string; available: boolean };
type Card = { id: string; status: Status; title: string; note: string; resource: LinkedResource | null };

const STATUSES: { key: Status; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];
const LABEL: Record<Status, string> = { todo: "To do", in_progress: "In progress", done: "Done" };

const SAVED: LinkedResource[] = [
  { id: "r1", title: "Demo lecture 1 – Placeholder sorting", courseCode: "DEMO 301", type: "Lecture", available: true },
  { id: "r2", title: "Sample exercises set 2", courseCode: "DEMO 301", type: "Exercise", available: true },
  { id: "r3", title: "Fake final exam 2024-2025", courseCode: "TEST 302", type: "Exam", available: true },
  { id: "r4", title: "Placeholder notes – chapter 3", courseCode: "TEST 302", type: "Notes", available: true },
];

const INITIAL: Card[] = [
  { id: "c1", status: "todo", title: "", note: "", resource: SAVED[2] },
  { id: "c2", status: "todo", title: "Revise chapters 1–3 before the partial", note: "Focus on the proofs.", resource: null },
  { id: "c3", status: "todo", title: "Redo exercise 4", note: "Got it wrong in the TD.", resource: SAVED[1] },
  { id: "c4", status: "in_progress", title: "", note: "", resource: SAVED[0] },
  { id: "c5", status: "in_progress", title: "Ask the TA about question 2b", note: "", resource: null },
  { id: "c6", status: "done", title: "Print the formula sheet", note: "", resource: null },
  {
    id: "c7",
    status: "done",
    title: "Old chapter summary",
    note: "",
    resource: { id: "gone", title: "Withdrawn file", courseCode: "DEMO 301", type: "Notes", available: false },
  },
];

const cardTitle = (card: Card) => card.title || card.resource?.title || "Untitled";

// ---------- board state ----------

function useBoard() {
  const [cards, setCards] = useState<Card[]>(INITIAL);
  const [editing, setEditing] = useState<Card | null>(null);
  const column = (status: Status) => cards.filter((c) => c.status === status);

  function move(id: string, status: Status) {
    // A moved card goes to the top of its new column.
    setCards((all) => {
      const card = all.find((c) => c.id === id)!;
      if (card.status === status) return all;
      return [{ ...card, status }, ...all.filter((c) => c.id !== id)];
    });
  }
  function shift(id: string, step: -1 | 1) {
    setCards((all) => {
      const card = all.find((c) => c.id === id)!;
      const siblings = all.filter((c) => c.status === card.status);
      const at = siblings.indexOf(card);
      const swap = siblings[at + step];
      if (!swap) return all;
      const a = all.indexOf(card);
      const b = all.indexOf(swap);
      const next = [...all];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  }
  function add(title: string, status: Status = "todo") {
    if (!title.trim()) return;
    setCards((all) => [{ id: crypto.randomUUID(), status, title: title.trim(), note: "", resource: null }, ...all]);
  }
  function save(card: Card) {
    setCards((all) => all.map((c) => (c.id === card.id ? card : c)));
  }
  function remove(id: string) {
    setCards((all) => all.filter((c) => c.id !== id));
  }
  return { cards, setCards, column, move, shift, add, save, remove, editing, setEditing };
}
type Board = ReturnType<typeof useBoard>;

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return desktop;
}

// ---------- shared small pieces ----------

function ResourceChip({ resource }: { resource: LinkedResource }) {
  if (!resource.available) {
    return (
      <span className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
        <FileText className="size-3.5" /> No longer available
      </span>
    );
  }
  return (
    <Link
      href="#reader"
      onClick={(e) => e.stopPropagation()}
      className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-link hover:underline"
    >
      <FileText className="size-3.5 shrink-0" />
      <span className="font-mono">{resource.courseCode}</span>
      <span className="truncate">{resource.type}</span>
    </Link>
  );
}

function MoveMenu({ board, card }: { board: Board; card: Card }) {
  const siblings = board.column(card.status);
  const at = siblings.findIndex((c) => c.id === card.id);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 md:size-8"
          aria-label={`Actions for ${cardTitle(card)}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        {STATUSES.filter((s) => s.key !== card.status).map((s) => (
          <DropdownMenuItem key={s.key} onSelect={() => board.move(card.id, s.key)}>
            {s.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={at === 0} onSelect={() => board.shift(card.id, -1)}>
          <ArrowUp /> Move up
        </DropdownMenuItem>
        <DropdownMenuItem disabled={at === siblings.length - 1} onSelect={() => board.shift(card.id, 1)}>
          <ArrowDown /> Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => board.setEditing(card)}>Edit…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CardBody({ card }: { card: Card }) {
  return (
    <div className="min-w-0 flex-1">
      <p className={`text-sm font-medium text-heading ${card.status === "done" ? "text-muted-foreground line-through" : ""}`}>
        {cardTitle(card)}
      </p>
      {card.note && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{card.note}</p>}
      {card.resource && card.title && <ResourceChip resource={card.resource} />}
      {card.resource && !card.title && (
        <p className="mt-1 text-xs text-muted-foreground">
          {card.resource.available ? (
            <>
              <span className="font-mono">{card.resource.courseCode}</span> · {card.resource.type}
            </>
          ) : (
            "No longer available"
          )}
        </p>
      )}
    </div>
  );
}

function QuickAdd({ board, placeholder = "Add a card…", big = false }: { board: Board; placeholder?: string; big?: boolean }) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        board.add(text);
        setText("");
      }}
    >
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        maxLength={200}
        className={big ? "h-12 text-base" : "h-11 md:h-9"}
        aria-label="New card title"
      />
      <Button type="submit" className={big ? "h-12 px-4" : "h-11 md:h-9"}>
        <Plus /> Add
      </Button>
    </form>
  );
}

// The edit dialog: a side sheet on desktop, a bottom sheet on a phone. Shared by every variant.
function CardSheet({ board }: { board: Board }) {
  // A fresh form (and draft) for every card opened.
  return <CardSheetForm key={board.editing?.id ?? "closed"} board={board} />;
}

function CardSheetForm({ board }: { board: Board }) {
  const desktop = useIsDesktop();
  const [draft, setDraft] = useState<Card | null>(board.editing);
  const [confirming, setConfirming] = useState(false);
  const [picking, setPicking] = useState(false);
  const close = () => board.setEditing(null);
  return (
    <Sheet open={board.editing !== null} onOpenChange={(open) => !open && close()}>
      <SheetContent side={desktop ? "right" : "bottom"} className={desktop ? "sm:max-w-md" : "max-h-[90vh] overflow-y-auto rounded-t-xl"}>
        {draft && (
          <>
            <SheetHeader>
              <SheetTitle>Edit card</SheetTitle>
              <SheetDescription>Only you can see your board.</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Title {draft.resource && <span className="font-normal text-muted-foreground">(optional, the file title is used)</span>}
                <Input
                  value={draft.title}
                  maxLength={200}
                  placeholder={draft.resource?.title ?? "What do you want to do?"}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="h-11"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Note
                <Textarea
                  value={draft.note}
                  maxLength={2000}
                  rows={4}
                  placeholder="Anything to remember"
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </label>
              <div className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Status</span>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                  {STATUSES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setDraft({ ...draft, status: s.key })}
                      className={`h-10 rounded-md text-sm ${draft.status === s.key ? "bg-card font-medium text-heading shadow-sm" : "text-muted-foreground"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">File</span>
                {draft.resource ? (
                  <div className="flex items-center gap-2 rounded-lg border p-2">
                    <FileText className="size-4 text-link" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{draft.resource.available ? draft.resource.title : "No longer available"}</span>
                      <span className="text-xs text-muted-foreground">{draft.resource.courseCode}</span>
                    </span>
                    {draft.resource.available && (
                      <Button variant="link" size="sm" asChild>
                        <Link href="#reader">Open</Link>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, resource: null })}>
                      Remove
                    </Button>
                  </div>
                ) : picking ? (
                  <ul className="flex flex-col gap-1 rounded-lg border p-1">
                    <li className="px-2 py-1 text-xs text-muted-foreground">From your saved files</li>
                    {SAVED.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setDraft({ ...draft, resource: r })}
                          className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-muted"
                        >
                          <Bookmark className="size-4 text-link" />
                          <span className="font-mono text-xs text-link">{r.courseCode}</span>
                          <span className="truncate">{r.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Button variant="outline" className="h-11 justify-start" onClick={() => setPicking(true)}>
                    <Bookmark /> Link one of your saved files
                  </Button>
                )}
              </div>
            </div>
            <SheetFooter className="flex-row justify-between gap-2">
              {confirming ? (
                <Button
                  variant="destructive"
                  className="h-11"
                  onClick={() => {
                    board.remove(draft.id);
                    close();
                  }}
                >
                  Delete this card?
                </Button>
              ) : (
                <Button variant="ghost" className="h-11 text-destructive" onClick={() => setConfirming(true)}>
                  <Trash2 /> Delete
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="h-11" onClick={close}>
                  Cancel
                </Button>
                <Button
                  className="h-11"
                  disabled={!draft.title.trim() && !draft.resource}
                  onClick={() => {
                    board.save(draft);
                    close();
                  }}
                >
                  Save
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------- Variant A: Jira columns (desktop drag), tabs on a phone ----------

function SortableCard({ board, card }: { board: Board; card: Card }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start gap-1 rounded-lg border bg-card p-2 shadow-xs ${isDragging ? "opacity-40" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${cardTitle(card)}`}
        className="mt-0.5 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <button type="button" className="min-w-0 flex-1 py-0.5 text-left" onClick={() => board.setEditing(card)}>
        <CardBody card={card} />
      </button>
      <MoveMenu board={board} card={card} />
    </li>
  );
}

function DroppableColumn({ status, children }: { status: Status; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` });
  return (
    <div ref={setNodeRef} className={`flex min-h-40 flex-col gap-2 rounded-xl bg-muted p-2 ${isOver ? "ring-2 ring-primary/40" : ""}`}>
      {children}
    </div>
  );
}

function VariantA({ board }: { board: Board }) {
  const [tab, setTab] = useState<Status>("todo");
  const [dragging, setDragging] = useState<Card | null>(null);
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const statusOf = (id: string): Status | undefined =>
    id.startsWith("column:") ? (id.slice(7) as Status) : board.cards.find((c) => c.id === id)?.status;

  function onStart(e: DragStartEvent) {
    setDragging(board.cards.find((c) => c.id === e.active.id) ?? null);
  }
  function onOver(e: DragOverEvent) {
    if (!e.over) return;
    const to = statusOf(String(e.over.id));
    const from = statusOf(String(e.active.id));
    if (!to || to === from) return;
    // Crossing into another column: put the card at the hovered card's place (or the end).
    board.setCards((all) => {
      const card = { ...all.find((c) => c.id === e.active.id)!, status: to };
      const rest = all.filter((c) => c.id !== card.id);
      const at = rest.findIndex((c) => c.id === e.over!.id);
      if (at === -1) return [...rest, card];
      return [...rest.slice(0, at), card, ...rest.slice(at)];
    });
  }
  function onEnd(e: DragEndEvent) {
    setDragging(null);
    if (!e.over || e.active.id === e.over.id) return;
    board.setCards((all) => {
      const from = all.findIndex((c) => c.id === e.active.id);
      const to = all.findIndex((c) => c.id === e.over!.id);
      if (to === -1) return all;
      const next = [...all];
      const [card] = next.splice(from, 1);
      next.splice(to, 0, card);
      return next;
    });
  }

  return (
    <>
      <div className="mb-4 md:hidden">
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={tab === s.key}
              onClick={() => setTab(s.key)}
              className={`h-11 rounded-md text-sm ${tab === s.key ? "bg-card font-medium text-heading shadow-sm" : "text-muted-foreground"}`}
            >
              {s.label} <span className="text-xs text-muted-foreground">{board.column(s.key).length}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {tab === "todo" && <QuickAdd board={board} />}
          <ul className="flex flex-col gap-2">
            {board.column(tab).map((card) => (
              <li key={card.id} className="flex items-start gap-1 rounded-lg border bg-card p-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => board.setEditing(card)}>
                  <CardBody card={card} />
                </button>
                <MoveMenu board={board} card={card} />
              </li>
            ))}
          </ul>
          {board.column(tab).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nothing here.</p>}
        </div>
      </div>

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd}>
        <div className="hidden grid-cols-3 gap-4 md:grid">
          {STATUSES.map((s) => (
            <section key={s.key} aria-label={s.label}>
              <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-heading">
                {s.label} <Badge variant="secondary">{board.column(s.key).length}</Badge>
              </h2>
              <DroppableColumn status={s.key}>
                {s.key === "todo" && <QuickAdd board={board} />}
                <SortableContext items={board.column(s.key).map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <ul className="flex flex-col gap-2">
                    {board.column(s.key).map((card) => (
                      <SortableCard key={card.id} board={board} card={card} />
                    ))}
                  </ul>
                </SortableContext>
                {board.column(s.key).length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">Drop a card here</p>
                )}
              </DroppableColumn>
            </section>
          ))}
        </div>
        <DragOverlay>
          {dragging && (
            <div className="rounded-lg border bg-card p-3 shadow-lg">
              <CardBody card={dragging} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
}

// ---------- Variant B: one list grouped by status, status pill on each card ----------

function StatusPill({ board, card }: { board: Board; card: Card }) {
  const tone =
    card.status === "done"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      : card.status === "in_progress"
        ? "bg-primary/10 text-link"
        : "bg-muted text-foreground";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={`inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-medium md:h-8 ${tone}`}>
          {LABEL[card.status]} <ChevronDown className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {STATUSES.map((s) => (
          <DropdownMenuItem key={s.key} onSelect={() => board.move(card.id, s.key)}>
            {s.key === card.status && <Check />} {s.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => board.shift(card.id, -1)}>
          <ArrowUp /> Move up
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => board.shift(card.id, 1)}>
          <ArrowDown /> Move down
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VariantB({ board }: { board: Board }) {
  const [openDone, setOpenDone] = useState(false);
  return (
    <div className="mx-auto max-w-2xl">
      <QuickAdd board={board} />
      {STATUSES.map((s) => {
        const items = board.column(s.key);
        const collapsed = s.key === "done" && !openDone;
        return (
          <section key={s.key} className="mt-6">
            <button
              type="button"
              disabled={s.key !== "done"}
              onClick={() => setOpenDone((v) => !v)}
              className="mb-2 flex w-full items-center gap-2 text-left text-sm font-semibold text-heading"
            >
              {s.key === "done" && <ChevronDown className={`size-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} />}
              {s.label} <span className="font-normal text-muted-foreground">{items.length}</span>
            </button>
            {!collapsed && (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {items.map((card) => (
                  <li key={card.id} className="flex items-center gap-3 px-3 py-2">
                    {card.resource ? <FileText className="size-4 shrink-0 text-link" /> : <StickyNote className="size-4 shrink-0 text-muted-foreground" />}
                    <button type="button" className="min-w-0 flex-1 py-1 text-left" onClick={() => board.setEditing(card)}>
                      <CardBody card={card} />
                    </button>
                    <StatusPill board={board} card={card} />
                  </li>
                ))}
                {items.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">Nothing here.</li>}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ---------- Variant C: focus on what you're doing now ----------

function VariantC({ board }: { board: Board }) {
  const [showDone, setShowDone] = useState(false);
  const now = board.column("in_progress");
  const next = board.column("todo");
  const done = board.column("done");
  return (
    <div className="mx-auto max-w-3xl">
      <QuickAdd board={board} placeholder="What do you want to do?" big />

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-heading">
          <CircleDot className="size-5 text-link" /> Working on now
        </h2>
        {now.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nothing in progress. Start something from Up next.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {now.map((card) => (
              <li key={card.id} className="flex flex-col rounded-xl border-2 border-primary/30 bg-card p-4">
                <button type="button" className="text-left" onClick={() => board.setEditing(card)}>
                  <CardBody card={card} />
                </button>
                <div className="mt-4 flex gap-2">
                  <Button className="h-11 flex-1" onClick={() => board.move(card.id, "done")}>
                    <Check /> Done
                  </Button>
                  <Button variant="outline" className="h-11" onClick={() => board.move(card.id, "todo")}>
                    Later
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-heading">
          Up next <span className="text-sm font-normal text-muted-foreground">{next.length}</span>
        </h2>
        <ul className="flex flex-col gap-2">
          {next.map((card) => (
            <li key={card.id} className="flex items-center gap-2 rounded-lg border bg-card p-2 pl-3">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => board.setEditing(card)}>
                <CardBody card={card} />
              </button>
              <Button variant="outline" className="h-11 md:h-9" onClick={() => board.move(card.id, "in_progress")}>
                <Play /> Start
              </Button>
              <MoveMenu board={board} card={card} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          className="flex h-11 items-center gap-2 text-sm font-medium text-muted-foreground"
        >
          <ChevronDown className={`size-4 transition-transform ${showDone ? "" : "-rotate-90"}`} />
          {done.length} done
        </button>
        {showDone && (
          <ul className="mt-2 flex flex-col gap-2">
            {done.map((card) => (
              <li key={card.id} className="flex items-center gap-2 rounded-lg bg-muted p-2 pl-3">
                <Check className="size-4 text-muted-foreground" />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => board.setEditing(card)}>
                  <CardBody card={card} />
                </button>
                <MoveMenu board={board} card={card} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------- page ----------

const VARIANTS = [
  { key: "A", name: "Jira columns" },
  { key: "B", name: "Grouped list" },
  { key: "C", name: "Focus on now" },
  { key: "D", name: "Rich columns" },
  { key: "E", name: "Course lanes" },
];

export function TodoPrototype() {
  const board = useBoard();
  const rich = useRichBoard();
  const variant = useSearchParams().get("variant") ?? "D";
  const wide = ["A", "D", "E"].includes(variant);
  if (variant === "D" || variant === "E") {
    return (
      <TooltipProvider>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:py-8">
          <PageTitle description="Your own plan. Only you can see it.">To-do</PageTitle>
          {variant === "D" ? <VariantD board={rich} /> : <VariantE board={rich} />}
          <PrototypeSwitcher variants={VARIANTS} fallback="D" />
        </main>
      </TooltipProvider>
    );
  }
  return (
    <main className={`mx-auto w-full px-4 py-6 md:py-8 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>
      <PageTitle description="Your own plan. Only you can see it.">To-do</PageTitle>
      {variant === "A" && <VariantA board={board} />}
      {variant === "B" && <VariantB board={board} />}
      {variant === "C" && <VariantC board={board} />}
      <CardSheet board={board} />
      <details className="mt-12 rounded-lg border border-dashed p-3 text-xs">
        <summary className="cursor-pointer text-muted-foreground">Prototype state (in memory, resets on reload)</summary>
        <pre className="mt-2 overflow-x-auto">
          {JSON.stringify(
            board.cards.map((c) => ({ status: c.status, title: cardTitle(c), resource: c.resource?.id ?? null })),
            null,
            2,
          )}
        </pre>
      </details>
      <PrototypeSwitcher variants={VARIANTS} fallback="D" />
    </main>
  );
}

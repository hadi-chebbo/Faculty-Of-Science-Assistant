"use client";

// PROTOTYPE ONLY (branch prototype/todo-board). Never merge to main.
// Round 2 of the board prototype: the owner liked A but found it too plain. Two richer variants:
//   D  Rich columns: tinted columns, richer cards, one-tap Start / Done, a card view like Jira's,
//      Undo after every move, a small celebration when something reaches Done, filters.
//   E  Course lanes: D's cards and columns, with one row per course (Jira "swimlanes").
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
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardCheck,
  Clock,
  MoreHorizontal,
  NotebookText,
  PencilLine,
  Play,
  Plus,
  Presentation,
  Search,
  StickyNote,
  Timer,
  Trash2,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ---------- fake data ----------

type Status = "todo" | "in_progress" | "done";
type ResourceType = "lecture" | "notes" | "exercise" | "exam";
type LinkedResource = {
  id: string;
  title: string;
  courseCode: string;
  courseTitle: string;
  type: ResourceType;
  available: boolean;
};
type Card = {
  id: string;
  status: Status;
  title: string;
  note: string;
  resource: LinkedResource | null;
  addedDaysAgo: number;
  movedDaysAgo: number;
};

const TYPE: Record<ResourceType, { label: string; icon: LucideIcon }> = {
  lecture: { label: "Lecture", icon: Presentation },
  notes: { label: "Notes", icon: NotebookText },
  exercise: { label: "Exercise", icon: PencilLine },
  exam: { label: "Exam", icon: ClipboardCheck },
};

const COURSES: Record<string, string> = { "DEMO 301": "Placeholder Algorithms", "TEST 302": "Sample Databases", "FAKE 303": "Mock Networks" };

const SAVED: LinkedResource[] = [
  { id: "r1", title: "Demo lecture 1 – Placeholder sorting", courseCode: "DEMO 301", courseTitle: COURSES["DEMO 301"], type: "lecture", available: true },
  { id: "r2", title: "Sample exercises set 2", courseCode: "DEMO 301", courseTitle: COURSES["DEMO 301"], type: "exercise", available: true },
  { id: "r3", title: "Fake final exam 2024-2025", courseCode: "TEST 302", courseTitle: COURSES["TEST 302"], type: "exam", available: true },
  { id: "r4", title: "Placeholder notes – chapter 3", courseCode: "TEST 302", courseTitle: COURSES["TEST 302"], type: "notes", available: true },
  { id: "r5", title: "Mock lecture 4 – Pretend routing", courseCode: "FAKE 303", courseTitle: COURSES["FAKE 303"], type: "lecture", available: true },
];

const INITIAL: Card[] = [
  { id: "c1", status: "todo", title: "", note: "", resource: SAVED[2], addedDaysAgo: 0, movedDaysAgo: 0 },
  { id: "c2", status: "todo", title: "Revise chapters 1–3 before the partial", note: "Focus on the proofs and the two examples from the lecture.", resource: null, addedDaysAgo: 1, movedDaysAgo: 1 },
  { id: "c3", status: "todo", title: "Redo exercise 4", note: "Got it wrong in the TD.", resource: SAVED[1], addedDaysAgo: 2, movedDaysAgo: 2 },
  { id: "c8", status: "todo", title: "Summarise the routing lecture", note: "", resource: SAVED[4], addedDaysAgo: 4, movedDaysAgo: 4 },
  { id: "c4", status: "in_progress", title: "", note: "Up to slide 24.", resource: SAVED[0], addedDaysAgo: 5, movedDaysAgo: 1 },
  { id: "c5", status: "in_progress", title: "Ask the TA about question 2b", note: "", resource: null, addedDaysAgo: 3, movedDaysAgo: 0 },
  { id: "c6", status: "done", title: "Print the formula sheet", note: "", resource: null, addedDaysAgo: 8, movedDaysAgo: 2 },
  { id: "c9", status: "done", title: "", note: "", resource: SAVED[3], addedDaysAgo: 9, movedDaysAgo: 3 },
  {
    id: "c7",
    status: "done",
    title: "Old chapter summary",
    note: "",
    resource: { id: "gone", title: "Withdrawn file", courseCode: "DEMO 301", courseTitle: COURSES["DEMO 301"], type: "notes", available: false },
    addedDaysAgo: 12,
    movedDaysAgo: 6,
  },
];

const titleOf = (card: Card) => card.title || card.resource?.title || "Untitled";
const ago = (days: number) => (days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);

// ---------- status look ----------

const STATUS: Record<
  Status,
  { label: string; icon: LucideIcon; bar: string; tint: string; iconTone: string; empty: string; tab: string }
> = {
  todo: {
    label: "To do",
    icon: Circle,
    bar: "bg-muted-foreground/40",
    tint: "bg-muted/80",
    iconTone: "text-muted-foreground",
    empty: "Nothing planned. Add the next thing you want to study.",
    tab: "border-muted-foreground/50",
  },
  in_progress: {
    label: "In progress",
    icon: Timer,
    bar: "bg-primary",
    tint: "bg-primary/[0.06]",
    iconTone: "text-link",
    empty: "Drag a card here, or press Start, when you begin.",
    tab: "border-primary",
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    bar: "bg-emerald-500",
    tint: "bg-emerald-500/[0.07]",
    iconTone: "text-emerald-600 dark:text-emerald-400",
    empty: "Finished cards land here. Enjoy it.",
    tab: "border-emerald-500",
  },
};
const ORDER: Status[] = ["todo", "in_progress", "done"];

// ---------- board state ----------

type Toast = { message: string; undo: Card[] | null };

export function useRichBoard() {
  const [cards, setCards] = useState<Card[]>(INITIAL);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!celebrate && !flash) return;
    const t = setTimeout(() => {
      setCelebrate(null);
      setFlash(null);
    }, 1200);
    return () => clearTimeout(t);
  }, [celebrate, flash]);

  // Called after a card changed column, by a button, a menu or a drag.
  function landed(id: string, status: Status, before: Card[]) {
    setFlash(id);
    if (status === "done") setCelebrate(id);
    setToast({ message: status === "done" ? "Nice, that's done." : `Moved to ${STATUS[status].label}`, undo: before });
  }
  function move(id: string, status: Status) {
    const card = cards.find((c) => c.id === id)!;
    if (card.status === status) return;
    const before = cards;
    // A moved card goes to the top of its new column.
    setCards([{ ...card, status, movedDaysAgo: 0 }, ...cards.filter((c) => c.id !== id)]);
    landed(id, status, before);
  }
  function shift(id: string, step: -1 | 1) {
    const card = cards.find((c) => c.id === id)!;
    const siblings = cards.filter((c) => c.status === card.status);
    const swap = siblings[siblings.indexOf(card) + step];
    if (!swap) return;
    setCards(arrayMove(cards, cards.indexOf(card), cards.indexOf(swap)));
  }
  function add(status: Status, title: string, resource: LinkedResource | null = null) {
    const id = crypto.randomUUID();
    setCards((all) => [{ id, status, title: title.trim(), note: "", resource, addedDaysAgo: 0, movedDaysAgo: 0 }, ...all]);
    setFlash(id);
    return id;
  }
  function update(id: string, patch: Partial<Card>) {
    const card = cards.find((c) => c.id === id)!;
    if (patch.status && patch.status !== card.status) {
      move(id, patch.status);
      return;
    }
    setCards((all) => all.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function remove(id: string) {
    const before = cards;
    setCards(cards.filter((c) => c.id !== id));
    setOpenId(null);
    setToast({ message: "Card deleted", undo: before });
  }
  function undo() {
    if (toast?.undo) setCards(toast.undo);
    setToast(null);
  }
  return { cards, setCards, move, shift, add, update, remove, undo, landed, openId, setOpenId, toast, celebrate, flash };
}
type Board = ReturnType<typeof useRichBoard>;

// ---------- card ----------

function CardMenu({ board, card }: { board: Board; card: Card }) {
  const siblings = board.cards.filter((c) => c.status === card.status);
  const at = siblings.findIndex((c) => c.id === card.id);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-1 -mt-1 size-9 shrink-0 text-muted-foreground opacity-100 data-[state=open]:opacity-100 md:size-8 md:opacity-0 md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100"
          aria-label={`Actions for ${titleOf(card)}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        {ORDER.filter((s) => s !== card.status).map((s) => {
          const Icon = STATUS[s].icon;
          return (
            <DropdownMenuItem key={s} onSelect={() => board.move(card.id, s)}>
              <Icon className={STATUS[s].iconTone} /> {STATUS[s].label}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={at === 0} onSelect={() => board.shift(card.id, -1)}>
          <ArrowUp /> Move up
        </DropdownMenuItem>
        <DropdownMenuItem disabled={at === siblings.length - 1} onSelect={() => board.shift(card.id, 1)}>
          <ArrowDown /> Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => board.setOpenId(card.id)}>
          <PencilLine /> Open card
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => board.remove(card.id)}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdvanceButton({ board, card }: { board: Board; card: Card }) {
  if (card.status === "done") return null;
  const toDone = card.status === "in_progress";
  return (
    <Button
      size="sm"
      variant={toDone ? "default" : "outline"}
      className={`h-9 gap-1.5 rounded-full px-3 text-xs md:h-7 ${toDone ? "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600" : ""}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        board.move(card.id, toDone ? "done" : "in_progress");
      }}
    >
      {toDone ? <Check className="size-3.5" /> : <Play className="size-3.5" />}
      {toDone ? "Done" : "Start"}
    </Button>
  );
}

function RichCard({ board, card, overlay = false, showCourse = true }: { board: Board; card: Card; overlay?: boolean; showCourse?: boolean }) {
  const done = card.status === "done";
  const r = card.resource;
  const TypeIcon = r ? TYPE[r.type].icon : StickyNote;
  const celebrating = board.celebrate === card.id;
  return (
    <article
      className={[
        "group/card relative rounded-xl border bg-card p-3 text-left shadow-xs transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
        overlay ? "rotate-1 scale-[1.02] cursor-grabbing border-primary/40 shadow-xl" : "cursor-grab active:cursor-grabbing",
        board.flash === card.id ? "ring-2 ring-primary/40" : "",
        celebrating ? "ring-2 ring-emerald-500/60" : "",
        done ? "bg-card/70" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-md ${r ? "bg-primary/10 text-link" : "bg-highlight/20 text-heading"}`}
          aria-hidden
        >
          <TypeIcon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-1 text-xs text-muted-foreground">
          {r ? (
            <>
              {showCourse && <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-link">{r.courseCode}</span>}
              <span>{TYPE[r.type].label}</span>
            </>
          ) : (
            <span>Note</span>
          )}
        </div>
        {!overlay && <CardMenu board={board} card={card} />}
      </div>

      <h3 className={`mt-2 text-sm font-medium leading-snug ${done ? "text-muted-foreground line-through decoration-emerald-500/70 decoration-2" : "text-heading"}`}>
        {titleOf(card)}
      </h3>
      {card.note && <p className="mt-1.5 line-clamp-2 border-l-2 border-muted pl-2 text-xs leading-relaxed text-muted-foreground">{card.note}</p>}
      {r && !r.available && (
        <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">This file is no longer available</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="size-3" />
          {done ? `Done ${ago(card.movedDaysAgo)}` : `Added ${ago(card.addedDaysAgo)}`}
        </span>
        <span className="flex-1" />
        {r?.available && !overlay && (
          <Link
            href="#reader"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-9 items-center gap-1 rounded-full px-2 text-xs font-medium text-link hover:bg-primary/10 md:h-7"
          >
            <BookOpen className="size-3.5" /> Open
          </Link>
        )}
        {!overlay && <AdvanceButton board={board} card={card} />}
        {done && (
          <span
            className={`flex size-6 items-center justify-center rounded-full bg-emerald-500 text-white ${celebrating ? "animate-in zoom-in-50 spin-in-12 duration-500" : ""}`}
            aria-label="Done"
          >
            <Check className="size-3.5" />
          </span>
        )}
      </div>
    </article>
  );
}

function SortableRichCard({ board, card, showCourse }: { board: Board; card: Card; showCourse?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription="Card. Press space to pick up, or Enter to open."
      onKeyDown={(e) => {
        if (e.key === "Enter") board.setOpenId(card.id);
        else listeners?.onKeyDown?.(e);
      }}
      onClick={() => board.setOpenId(card.id)}
      className="rounded-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {isDragging ? (
        <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5" style={{ height: 112 }} />
      ) : (
        <RichCard board={board} card={card} showCourse={showCourse} />
      )}
    </li>
  );
}

// ---------- adding ----------

function Composer({ board, status, onDone }: { board: Board; status: Status; onDone: () => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<LinkedResource | null>(null);
  const [picking, setPicking] = useState(false);
  function submit() {
    if (!text.trim() && !file) return;
    board.add(status, text, file);
    setText("");
    setFile(null);
  }
  return (
    <div className="rounded-xl border bg-card p-2 shadow-sm">
      <Textarea
        autoFocus
        value={text}
        maxLength={200}
        rows={2}
        placeholder={file ? "Title (optional)" : "What do you want to do?"}
        className="resize-none border-0 p-1 shadow-none focus-visible:ring-0"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") onDone();
        }}
      />
      {file && (
        <div className="mx-1 mb-2 flex items-center gap-2 rounded-md bg-muted px-2 py-1.5 text-xs">
          <Bookmark className="size-3.5 text-link" />
          <span className="font-mono text-link">{file.courseCode}</span>
          <span className="truncate">{file.title}</span>
          <button type="button" className="ml-auto" aria-label="Remove file" onClick={() => setFile(null)}>
            <X className="size-3.5" />
          </button>
        </div>
      )}
      {picking && !file && (
        <ul className="mx-1 mb-2 max-h-48 overflow-y-auto rounded-md border p-1">
          {SAVED.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  setFile(r);
                  setPicking(false);
                }}
                className="flex min-h-10 w-full items-center gap-2 rounded px-2 text-left text-xs hover:bg-muted"
              >
                <span className="font-mono text-link">{r.courseCode}</span>
                <span className="truncate">{r.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-1">
        <Button size="sm" className="h-9 md:h-8" onClick={submit}>
          Add card
        </Button>
        <Button size="sm" variant="ghost" className="h-9 md:h-8" onClick={onDone}>
          Cancel
        </Button>
        <span className="flex-1" />
        {!file && (
          <Button size="sm" variant="ghost" className="h-9 text-xs text-link md:h-8" onClick={() => setPicking((v) => !v)}>
            <Bookmark className="size-3.5" /> Link a saved file
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------- card view (like a Jira issue) ----------

function CardDialog({ board }: { board: Board }) {
  const card = board.cards.find((c) => c.id === board.openId) ?? null;
  const [confirm, setConfirm] = useState(false);
  const [picking, setPicking] = useState(false);
  return (
    <Dialog
      open={card !== null}
      onOpenChange={(open) => {
        if (!open) {
          board.setOpenId(null);
          setConfirm(false);
          setPicking(false);
        }
      }}
    >
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        {card && (
          <>
            <div className={`h-1.5 w-full ${STATUS[card.status].bar}`} aria-hidden />
            <div className="grid md:grid-cols-[1fr_15rem]">
              <div className="flex flex-col gap-5 p-5 md:p-6">
                <div>
                  <DialogTitle className="sr-only">{titleOf(card)}</DialogTitle>
                  <DialogDescription className="sr-only">Edit this card. Changes are saved as you type.</DialogDescription>
                  <Textarea
                    value={card.title}
                    rows={1}
                    maxLength={200}
                    placeholder={card.resource?.title ?? "What do you want to do?"}
                    onChange={(e) => board.update(card.id, { title: e.target.value })}
                    className="min-h-0 resize-none border-0 px-0 text-xl font-semibold text-heading shadow-none focus-visible:ring-0 md:text-2xl"
                    aria-label="Title"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Changes are saved as you type.</p>
                </div>

                <section>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note</h4>
                  <Textarea
                    value={card.note}
                    rows={5}
                    maxLength={2000}
                    placeholder="Add details: pages, questions to ask, what went wrong last time…"
                    onChange={(e) => board.update(card.id, { note: e.target.value })}
                  />
                  <p className="mt-1 text-right text-[11px] text-muted-foreground">{card.note.length} / 2000</p>
                </section>

                <section>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">File</h4>
                  {card.resource ? (
                    <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
                      {(() => {
                        const Icon = TYPE[card.resource.type].icon;
                        return (
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-link">
                            <Icon className="size-5" />
                          </span>
                        );
                      })()}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-heading">
                          {card.resource.available ? card.resource.title : "This file is no longer available"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">{card.resource.courseCode}</span> · {card.resource.courseTitle} · {TYPE[card.resource.type].label}
                        </p>
                      </div>
                      {card.resource.available && (
                        <Button asChild size="sm" className="h-9">
                          <Link href="#reader">
                            <BookOpen /> Open
                          </Link>
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-9" aria-label="Remove the file" onClick={() => board.update(card.id, { resource: null })}>
                        <X />
                      </Button>
                    </div>
                  ) : picking ? (
                    <ul className="rounded-xl border p-1">
                      <li className="px-2 py-1 text-xs text-muted-foreground">Your saved files</li>
                      {SAVED.map((r) => {
                        const Icon = TYPE[r.type].icon;
                        return (
                          <li key={r.id}>
                            <button
                              type="button"
                              onClick={() => {
                                board.update(card.id, { resource: r });
                                setPicking(false);
                              }}
                              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted"
                            >
                              <Icon className="size-4 text-link" />
                              <span className="font-mono text-xs text-link">{r.courseCode}</span>
                              <span className="truncate">{r.title}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPicking(true)}
                      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm text-muted-foreground hover:border-primary/40 hover:text-link"
                    >
                      <Bookmark className="size-4" /> Link one of your saved files
                    </button>
                  )}
                </section>
              </div>

              <aside className="flex flex-col gap-5 border-t bg-muted/40 p-5 md:border-l md:border-t-0">
                <section>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</h4>
                  <div className="flex flex-col gap-1">
                    {ORDER.map((s) => {
                      const Icon = STATUS[s].icon;
                      const active = card.status === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={active}
                          onClick={() => board.update(card.id, { status: s })}
                          className={`flex h-11 items-center gap-2 rounded-lg px-3 text-sm transition-colors ${active ? "bg-card font-medium text-heading shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-card/60"}`}
                        >
                          <Icon className={`size-4 ${STATUS[s].iconTone}`} />
                          {STATUS[s].label}
                          {active && <Check className="ml-auto size-4 text-link" />}
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section className="text-sm">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</h4>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">Added</dt>
                    <dd>{ago(card.addedDaysAgo)}</dd>
                    <dt className="text-muted-foreground">In this column</dt>
                    <dd>since {ago(card.movedDaysAgo)}</dd>
                    {card.resource && (
                      <>
                        <dt className="text-muted-foreground">Course</dt>
                        <dd className="font-mono">{card.resource.courseCode}</dd>
                      </>
                    )}
                  </dl>
                </section>
                <div className="mt-auto">
                  {confirm ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs">Delete this card? You can undo right after.</p>
                      <div className="flex gap-2">
                        <Button variant="destructive" className="h-10 flex-1" onClick={() => board.remove(card.id)}>
                          Delete
                        </Button>
                        <Button variant="outline" className="h-10" onClick={() => setConfirm(false)}>
                          Keep
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="ghost" className="h-10 w-full justify-start text-destructive" onClick={() => setConfirm(true)}>
                      <Trash2 /> Delete card
                    </Button>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- toolbar, toast ----------

type Filter = { query: string; course: string };

function matches(card: Card, f: Filter) {
  if (f.course === "notes" && card.resource) return false;
  if (f.course !== "all" && f.course !== "notes" && card.resource?.courseCode !== f.course) return false;
  const q = f.query.trim().toLowerCase();
  return !q || `${titleOf(card)} ${card.note} ${card.resource?.courseCode ?? ""}`.toLowerCase().includes(q);
}

function Toolbar({ filter, setFilter, onNew }: { filter: Filter; setFilter: (f: Filter) => void; onNew: () => void }) {
  const chips = [
    { key: "all", label: "All" },
    ...Object.keys(COURSES).map((code) => ({ key: code, label: code })),
    { key: "notes", label: "Notes only" },
  ];
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative md:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter.query}
          onChange={(e) => setFilter({ ...filter, query: e.target.value })}
          placeholder="Filter cards"
          className="h-11 bg-card pl-9 md:h-9"
          aria-label="Filter cards"
        />
      </div>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            aria-pressed={filter.course === chip.key}
            onClick={() => setFilter({ ...filter, course: chip.key })}
            className={`h-9 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors md:h-8 ${filter.course === chip.key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:border-primary/40"} ${chip.key.includes(" ") ? "font-mono" : ""}`}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <span className="flex-1" />
      <Button className="hidden h-9 md:inline-flex" onClick={onNew}>
        <Plus /> New card <kbd className="ml-1 rounded bg-primary-foreground/20 px-1.5 text-[10px]">N</kbd>
      </Button>
    </div>
  );
}

function ToastBar({ board }: { board: Board }) {
  if (!board.toast) return null;
  return (
    <div
      role="status"
      className="fixed bottom-[8.5rem] left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full bg-foreground py-2 pl-4 pr-2 text-sm text-background shadow-xl animate-in fade-in slide-in-from-bottom-4 md:bottom-20"
    >
      {board.toast.message.startsWith("Nice") && <CheckCircle2 className="size-4 text-emerald-400" />}
      {board.toast.message}
      {board.toast.undo && (
        <button type="button" onClick={board.undo} className="inline-flex h-8 items-center gap-1 rounded-full px-3 font-medium hover:bg-background/15">
          <Undo2 className="size-3.5" /> Undo
        </button>
      )}
    </div>
  );
}

// ---------- drag and drop shared by D and E ----------

const NO_LANE = "_";
const containerId = (lane: string, status: Status) => `col|${lane}|${status}`;

function useBoardDnd(board: Board, laneOf: (card: Card) => string) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const startStatus = useRef<Status | null>(null);
  const startCards = useRef<Card[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const where = (id: string): { lane: string; status: Status } | null => {
    if (id.startsWith("col|")) {
      const [, lane, status] = id.split("|");
      return { lane, status: status as Status };
    }
    const card = board.cards.find((c) => c.id === id);
    return card ? { lane: laneOf(card), status: card.status } : null;
  };
  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    startStatus.current = board.cards.find((c) => c.id === e.active.id)?.status ?? null;
    startCards.current = board.cards;
  }
  function onDragOver(e: DragOverEvent) {
    if (!e.over) return;
    const from = where(String(e.active.id));
    const to = where(String(e.over.id));
    // A card stays in its own lane: its course comes from its file, not from where it is dropped.
    if (!from || !to || from.lane !== to.lane || from.status === to.status) return;
    board.setCards((all) => {
      const card = { ...all.find((c) => c.id === e.active.id)!, status: to.status, movedDaysAgo: 0 };
      const rest = all.filter((c) => c.id !== card.id);
      const at = rest.findIndex((c) => c.id === e.over!.id);
      return at === -1 ? [...rest, card] : [...rest.slice(0, at), card, ...rest.slice(at)];
    });
  }
  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    setActiveId(null);
    if (e.over && e.over.id !== id && !String(e.over.id).startsWith("col|")) {
      board.setCards((all) => {
        const a = all.findIndex((c) => c.id === id);
        const b = all.findIndex((c) => c.id === e.over!.id);
        if (b === -1 || all[a].status !== all[b].status) return all;
        return arrayMove(all, a, b);
      });
    }
    const now = board.cards.find((c) => c.id === id)?.status;
    if (now && now !== startStatus.current) board.landed(id, now, startCards.current);
  }
  const active = board.cards.find((c) => c.id === activeId) ?? null;
  return { sensors, onDragStart, onDragOver, onDragEnd, onDragCancel: () => setActiveId(null), active };
}

function DropZone({ id, className, children }: { id: string; className: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className} transition-shadow ${isOver ? "ring-2 ring-primary/30" : ""}`}>
      {children}
    </div>
  );
}

function ColumnHeader({ status, count, onAdd }: { status: Status; count: number; onAdd?: () => void }) {
  const meta = STATUS[status];
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon className={`size-4 ${meta.iconTone}`} />
      <h2 className="text-sm font-semibold text-heading">{meta.label}</h2>
      <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">{count}</span>
      <span className="flex-1" />
      {onAdd && (
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`Add a card to ${meta.label}`} onClick={onAdd}>
          <Plus className="size-4" />
        </Button>
      )}
    </div>
  );
}

function EmptyColumn({ status }: { status: Status }) {
  const Icon = STATUS[status].icon;
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border/80 px-4 py-8 text-center">
      <Icon className={`size-6 ${STATUS[status].iconTone} opacity-60`} />
      <p className="text-xs text-muted-foreground">{STATUS[status].empty}</p>
    </div>
  );
}

// ---------- phone (shared by D and E) ----------

function PhoneBoard({ board, filter, grouped }: { board: Board; filter: Filter; grouped: boolean }) {
  const [tab, setTab] = useState<Status>("todo");
  const [adding, setAdding] = useState(false);
  const visible = board.cards.filter((c) => c.status === tab && matches(c, filter));
  const lanes = grouped ? [...new Set(visible.map(laneKey))] : [NO_LANE];
  return (
    <div className="md:hidden">
      <div role="tablist" className="grid grid-cols-3 border-b">
        {ORDER.map((s) => {
          const Icon = STATUS[s].icon;
          const count = board.cards.filter((c) => c.status === s && matches(c, filter)).length;
          return (
            <button
              key={s}
              role="tab"
              aria-selected={tab === s}
              onClick={() => setTab(s)}
              className={`-mb-px flex h-12 items-center justify-center gap-1.5 border-b-2 text-sm ${tab === s ? `${STATUS[s].tab} font-semibold text-heading` : "border-transparent text-muted-foreground"}`}
            >
              <Icon className={`size-4 ${tab === s ? STATUS[s].iconTone : ""}`} />
              {STATUS[s].label}
              <span className="text-xs text-muted-foreground">{count}</span>
            </button>
          );
        })}
      </div>
      <div className={`-mx-4 mt-0 min-h-80 px-4 py-4 ${STATUS[tab].tint}`}>
        {adding && (
          <div className="mb-3">
            <Composer board={board} status={tab} onDone={() => setAdding(false)} />
          </div>
        )}
        {visible.length === 0 && !adding && <EmptyColumn status={tab} />}
        {lanes.map((lane) => (
          <div key={lane} className="mb-4">
            {grouped && <LaneTitle lane={lane} count={visible.filter((c) => laneKey(c) === lane).length} />}
            <ul className="flex flex-col gap-2.5">
              {visible
                .filter((c) => !grouped || laneKey(c) === lane)
                .map((card) => (
                  <li key={card.id} onClick={() => board.setOpenId(card.id)}>
                    <RichCard board={board} card={card} showCourse={!grouped} />
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <Button
        className="fixed bottom-[5rem] right-4 z-30 size-14 rounded-full shadow-lg"
        aria-label="New card"
        onClick={() => setAdding(true)}
      >
        <Plus className="size-6" />
      </Button>
    </div>
  );
}

// ---------- Variant D: rich columns ----------

export function VariantD({ board }: { board: Board }) {
  const [filter, setFilter] = useState<Filter>({ query: "", course: "all" });
  const [adding, setAdding] = useState<Status | null>(null);
  const dnd = useBoardDnd(board, () => NO_LANE);
  const dndId = useId();
  useNewCardKey(() => setAdding("todo"));

  return (
    <>
      <Toolbar filter={filter} setFilter={setFilter} onNew={() => setAdding("todo")} />
      <PhoneBoard board={board} filter={filter} grouped={false} />
      <DndContext id={dndId} sensors={dnd.sensors} collisionDetection={closestCorners} onDragStart={dnd.onDragStart} onDragOver={dnd.onDragOver} onDragEnd={dnd.onDragEnd} onDragCancel={dnd.onDragCancel}>
        <div className="hidden grid-cols-3 items-start gap-4 md:grid">
          {ORDER.map((s) => {
            const items = board.cards.filter((c) => c.status === s && matches(c, filter));
            return (
              <section key={s} aria-label={STATUS[s].label} className={`overflow-hidden rounded-2xl ${STATUS[s].tint}`}>
                <div className={`h-1 ${STATUS[s].bar}`} aria-hidden />
                <div className="flex flex-col gap-3 p-3">
                  <ColumnHeader status={s} count={items.length} onAdd={() => setAdding(s)} />
                  <DropZone id={containerId(NO_LANE, s)} className="flex min-h-48 flex-col gap-2.5 rounded-xl">
                    {adding === s && <Composer board={board} status={s} onDone={() => setAdding(null)} />}
                    <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                      <ul className="flex flex-col gap-2.5">
                        {items.map((card) => (
                          <SortableRichCard key={card.id} board={board} card={card} />
                        ))}
                      </ul>
                    </SortableContext>
                    {items.length === 0 && adding !== s && <EmptyColumn status={s} />}
                  </DropZone>
                  {adding !== s && (
                    <button
                      type="button"
                      onClick={() => setAdding(s)}
                      className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:bg-card hover:text-heading"
                    >
                      <Plus className="size-4" /> Add a card
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
          {dnd.active && <RichCard board={board} card={dnd.active} overlay />}
        </DragOverlay>
      </DndContext>
      <CardDialog board={board} />
      <ToastBar board={board} />
    </>
  );
}

// ---------- Variant E: course lanes ----------

function laneKey(card: Card) {
  return card.resource?.courseCode ?? "personal";
}

function LaneTitle({ lane, count }: { lane: string; count: number }) {
  return (
    <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-heading">
      {lane === "personal" ? (
        <>
          <StickyNote className="size-3.5 text-muted-foreground" /> Personal notes
        </>
      ) : (
        <>
          <span className="font-mono text-link">{lane}</span>
          <span className="font-normal text-muted-foreground">{COURSES[lane]}</span>
        </>
      )}
      <span className="font-normal text-muted-foreground">· {count}</span>
    </h3>
  );
}

export function VariantE({ board }: { board: Board }) {
  const [filter, setFilter] = useState<Filter>({ query: "", course: "all" });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null); // "lane|status"
  const dnd = useBoardDnd(board, laneKey);
  const dndId = useId();
  useNewCardKey(() => setAdding(`personal|todo`));

  const visible = board.cards.filter((c) => matches(c, filter));
  const lanes = [...Object.keys(COURSES), "personal"].filter((l) => visible.some((c) => laneKey(c) === l) || l === "personal");

  return (
    <>
      <Toolbar filter={filter} setFilter={setFilter} onNew={() => setAdding("personal|todo")} />
      <PhoneBoard board={board} filter={filter} grouped />
      <DndContext id={dndId} sensors={dnd.sensors} collisionDetection={closestCorners} onDragStart={dnd.onDragStart} onDragOver={dnd.onDragOver} onDragEnd={dnd.onDragEnd} onDragCancel={dnd.onDragCancel}>
        <div className="hidden md:block">
          <div className="sticky top-0 z-10 grid grid-cols-3 gap-4 bg-background/90 py-2 backdrop-blur">
            {ORDER.map((s) => (
              <div key={s} className={`overflow-hidden rounded-xl ${STATUS[s].tint}`}>
                <div className={`h-1 ${STATUS[s].bar}`} aria-hidden />
                <div className="p-2">
                  <ColumnHeader status={s} count={visible.filter((c) => c.status === s).length} />
                </div>
              </div>
            ))}
          </div>
          {lanes.map((lane) => {
            const inLane = visible.filter((c) => laneKey(c) === lane);
            const isCollapsed = collapsed.has(lane);
            return (
              <section key={lane} className="mt-4" aria-label={lane === "personal" ? "Personal notes" : lane}>
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  onClick={() =>
                    setCollapsed((set) => {
                      const next = new Set(set);
                      if (next.has(lane)) next.delete(lane);
                      else next.add(lane);
                      return next;
                    })
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-muted"
                >
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                  <LaneTitle lane={lane} count={inLane.length} />
                  {isCollapsed && (
                    <span className="mb-2 ml-auto flex gap-3 text-xs text-muted-foreground">
                      {ORDER.map((s) => (
                        <span key={s}>
                          {STATUS[s].label} {inLane.filter((c) => c.status === s).length}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
                {!isCollapsed && (
                  <div className="grid grid-cols-3 gap-4">
                    {ORDER.map((s) => {
                      const items = inLane.filter((c) => c.status === s);
                      const key = `${lane}|${s}`;
                      return (
                        <DropZone key={s} id={containerId(lane, s)} className={`group/cell flex min-h-24 flex-col gap-2 rounded-xl p-2 ${STATUS[s].tint}`}>
                          {adding === key && <Composer board={board} status={s} onDone={() => setAdding(null)} />}
                          <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                            <ul className="flex flex-col gap-2">
                              {items.map((card) => (
                                <SortableRichCard key={card.id} board={board} card={card} showCourse={false} />
                              ))}
                            </ul>
                          </SortableContext>
                          {lane === "personal" && adding !== key && (
                            <button
                              type="button"
                              onClick={() => setAdding(key)}
                              className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground opacity-0 hover:bg-card hover:text-heading focus-visible:opacity-100 group-hover/cell:opacity-100"
                            >
                              <Plus className="size-3.5" /> Add a note
                            </button>
                          )}
                        </DropZone>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
          {dnd.active && <RichCard board={board} card={dnd.active} overlay showCourse={false} />}
        </DragOverlay>
      </DndContext>
      <CardDialog board={board} />
      <ToastBar board={board} />
    </>
  );
}

// N opens a new card, when not typing.
function useNewCardKey(open: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || t.closest("input, textarea, [contenteditable], [role=dialog]")) return;
      e.preventDefault();
      open();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}

"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TODO_STATUSES, type TodoStatus } from "@/db/constants";
import { showUndoToast } from "@/lib/undo-toast";
import type { TodoCard } from "@/services/todos/types";
import { BOARD_FULL_MESSAGE, boardRequest } from "./board-api";
import { CardComposer } from "./card-composer";
import { CardViewDialog } from "./card-view-dialog";
import { TodoCardView, type BoardCard } from "./todo-card";
import { STATUS_LOOK } from "./todo-status";
import { useCardSaver, type Edit } from "./use-card-saver";

const SIGN_IN = `/sign-in?next=${encodeURIComponent("/todo")}`;

// The board is drawn twice (phone tabs and desktop columns, one hidden by CSS), so a control is
// looked up among the copies that are on screen.
function visibleElement(selector: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>(selector)].find((el) => el.getClientRects().length > 0);
}

// Puts the focus back on whichever "add" control is on screen (the column's "Add a card" on
// desktop, the round "+" on a phone) once the composer has gone.
function focusAddControl(status: TodoStatus, delay = 0) {
  setTimeout(() => {
    const visible = [...document.querySelectorAll<HTMLElement>("[data-add-card]")].filter(
      (el) => el.dataset.addCard === status && el.getClientRects().length > 0,
    );
    visible[0]?.focus();
  }, delay);
}

const focusCard = (id: string, delay = 0) => setTimeout(() => visibleElement(`[data-card-open="${id}"]`)?.focus(), delay);

// Where the focus goes when a card disappears: the card after it, else the one before it, else the
// column's "Add a card". Worked out before the card leaves the page.
function focusAfterRemoval(id: string, status: TodoStatus): (delay?: number) => void {
  const li = visibleElement(`[data-card-open="${id}"]`)?.closest("li");
  const neighbour = li?.nextElementSibling ?? li?.previousElementSibling;
  const nextId = neighbour?.querySelector<HTMLElement>("[data-card-open]")?.dataset.cardOpen;
  return (delay = 0) => (nextId ? focusCard(nextId, delay) : focusAddControl(status, delay));
}

// Puts a card back among the cards of its column at `index` (0 = top), wherever the array keeps
// that column's cards.
function insertInColumn(all: BoardCard[], card: BoardCard, index: number): BoardCard[] {
  const column = all.filter((c) => c.status === card.status);
  if (column.length === 0) return [...all, card];
  const at = Math.min(index, column.length);
  const position = at < column.length ? all.indexOf(column[at]) : all.indexOf(column[column.length - 1]) + 1;
  return [...all.slice(0, position), card, ...all.slice(position)];
}

// The signed-in student's board, following variant D of the prototype: three tinted columns on a
// desktop, tabs with one column at a time on a phone. Adding a card is optimistic: it appears at
// the top of its column at once and is replaced by the server's card, or removed with a message.
// A card opens into one card view (a dialog) owned by the board; deleting hides the card at once
// and offers Undo.
export function TodoBoard({ initialCards, serverNow }: { initialCards: TodoCard[]; serverNow: string }) {
  const router = useRouter();
  const [cards, setCards] = useState<BoardCard[]>(initialCards);
  const [adding, setAdding] = useState<TodoStatus | null>(null);
  const [phoneTab, setPhoneTab] = useState<TodoStatus>("todo");
  const [openId, setOpenId] = useState<string | null>(null);
  // "Added 5 minutes ago" starts from the server's clock (so the first render matches the HTML)
  // and is refreshed every minute afterwards.
  const [now, setNow] = useState(serverNow);
  const tempCounter = useRef(0);
  // Requests go to the server one after another, so cards land in the order they were added and an
  // Undo is always sent after its delete.
  const queue = useRef<Promise<void>>(Promise.resolve());
  // What the server has for each card, to put back a title it refused.
  const saved = useRef(new Map(initialCards.map((c) => [c.id, { title: c.title, note: c.note }])));
  const closeFocus = useRef<(() => void) | null>(null);
  const lastOpened = useRef<string | null>(null);
  const saver = useCardSaver({
    onSaved: (card) => saved.current.set(card.id, { title: card.title, note: card.note }),
    onSignedOut: () => router.push(SIGN_IN),
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), 60_000);
    return () => clearInterval(timer);
  }, []);

  function openComposer(status: TodoStatus) {
    setPhoneTab(status);
    setAdding(status);
  }

  function closeComposer() {
    const status = adding;
    setAdding(null);
    if (status) focusAddControl(status);
  }

  // N opens the To do composer, unless the student is typing or holding a modifier key.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (target?.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      event.preventDefault();
      setPhoneTab("todo");
      setAdding("todo");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function add(status: TodoStatus, title: string) {
    const tempId = `pending-${++tempCounter.current}`;
    const stamp = new Date().toISOString();
    const temp: BoardCard = {
      id: tempId, status, position: 0, title, note: "", createdAt: stamp, updatedAt: stamp, statusChangedAt: stamp, pending: true,
    };
    setCards((all) => [temp, ...all]);
    const drop = () => setCards((all) => all.filter((c) => c.id !== tempId));

    queue.current = queue.current.then(async () => {
      try {
        const response = await boardRequest("POST", "", { title, status });
        if (response.ok) {
          const { card } = (await response.json()) as { card: TodoCard };
          saved.current.set(card.id, { title: card.title, note: card.note });
          setCards((all) => all.map((c) => (c.id === tempId ? card : c)));
        } else if (response.status === 401) {
          drop();
          router.push(SIGN_IN);
        } else if (response.status === 409) {
          drop();
          toast.error(BOARD_FULL_MESSAGE);
        } else {
          drop();
          toast.error("Couldn't add the card. Try again.");
        }
      } catch {
        drop();
        toast.error("Couldn't add the card. Try again.");
      }
    });
  }

  function openCard(id: string) {
    lastOpened.current = id;
    closeFocus.current = null;
    setOpenId(id);
  }

  // Closing the card view sends what is still waiting.
  function closeCard() {
    const id = openId;
    setOpenId(null);
    if (!id) return;
    saver.flush(id);
    setCards((all) => all.map((c) => (c.id === id ? { ...c, title: c.title.trim() } : c)));
  }

  function editCard(id: string, change: Edit) {
    setCards((all) => all.map((c) => (c.id === id ? { ...c, ...change } : c)));
    saver.edit(id, change);
  }

  // A title the server refused (the answer can arrive after the card view has closed) goes back to
  // the last saved one, so the board never shows text that was not saved.
  useEffect(() => {
    for (const [id, info] of Object.entries(saver.info)) {
      if (id === openId || !info.invalidFields.includes("title")) continue;
      const title = saved.current.get(id)?.title;
      if (title === undefined) continue;
      setCards((all) => (all.some((c) => c.id === id && c.title !== title) ? all.map((c) => (c.id === id ? { ...c, title } : c)) : all));
    }
  }, [saver.info, openId]);

  // Delete hides the card at once and shows "Card deleted · Undo".
  function removeCard(id: string, fromMenu = false) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.pending) return;
    const index = cards.filter((c) => c.status === card.status).indexOf(card);
    const refocus = focusAfterRemoval(id, card.status);
    saver.discard(id);
    setCards((all) => all.filter((c) => c.id !== id));
    if (openId === id) {
      setOpenId(null);
      closeFocus.current = () => refocus();
    } else if (fromMenu) {
      // After the menu has handed the focus back to its (now gone) button.
      refocus(60);
    }

    const toastId = showUndoToast("Card deleted", () => restoreCard(id));
    queue.current = queue.current.then(async () => {
      let failed = false;
      try {
        const response = await boardRequest("DELETE", `/${id}`);
        if (response.status === 401) {
          router.push(SIGN_IN);
          return;
        }
        failed = !response.ok;
      } catch {
        failed = true;
      }
      if (failed) {
        toast.dismiss(toastId);
        setCards((all) => (all.some((c) => c.id === id) ? all : insertInColumn(all, card, index)));
        toast.error("Couldn't delete the card. Try again.");
      }
    });
  }

  function restoreCard(id: string) {
    queue.current = queue.current.then(async () => {
      try {
        const response = await boardRequest("POST", `/${id}/restore`);
        if (response.ok) {
          const { card } = (await response.json()) as { card: TodoCard };
          saved.current.set(card.id, { title: card.title, note: card.note });
          // Back in its old column and place (the server's position counts from the top).
          setCards((all) => (all.some((c) => c.id === id) ? all : insertInColumn(all, card, card.position)));
        } else if (response.status === 401) {
          router.push(SIGN_IN);
        } else if (response.status === 409) {
          toast.error(BOARD_FULL_MESSAGE);
        } else if (response.status === 404) {
          toast.error("This card can't be restored any more.");
        } else {
          toast.error("Couldn't restore the card. Try again.");
        }
      } catch {
        toast.error("Couldn't restore the card. Try again.");
      }
    });
  }

  const inColumn = (status: TodoStatus) => cards.filter((c) => c.status === status);
  const listProps = { now, onOpen: openCard, onDelete: (id: string) => removeCard(id, true) };

  return (
    <>
      <div className="mb-4 hidden justify-end md:flex">
        <Button onClick={() => openComposer("todo")}>
          <Plus aria-hidden /> New card
          <kbd className="ml-1 rounded border border-primary-foreground/40 px-1 text-[10px] leading-4" aria-hidden>
            N
          </kbd>
        </Button>
      </div>

      {/* Phone: one column at a time. */}
      <Tabs value={phoneTab} onValueChange={(value) => setPhoneTab(value as TodoStatus)} className="gap-0 md:hidden">
        <TabsList variant="line" className="h-12 w-full gap-0 border-b p-0">
          {TODO_STATUSES.map((status) => {
            const look = STATUS_LOOK[status];
            const Icon = look.icon;
            const active = phoneTab === status;
            return (
              <TabsTrigger
                key={status}
                value={status}
                className={`h-12 min-w-0 rounded-none border-0 border-b-2 border-transparent px-1 after:hidden ${look.tab} data-active:font-semibold data-active:text-heading`}
              >
                <Icon className={active ? look.iconTone : ""} aria-hidden />
                {look.label}
                <span className="text-xs text-muted-foreground">{inColumn(status).length}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {TODO_STATUSES.map((status) => (
          <TabsContent key={status} value={status} className={`-mx-4 min-h-80 px-4 py-4 ${STATUS_LOOK[status].tint}`}>
            {adding === status && (
              <div className="mb-3">
                <CardComposer status={status} onAdd={add} onClose={closeComposer} />
              </div>
            )}
            <CardList cards={inColumn(status)} status={status} showEmpty={adding !== status} {...listProps} />
          </TabsContent>
        ))}
      </Tabs>
      <Button
        data-add-card={phoneTab}
        id="add-card-fab"
        aria-label="New card"
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg md:hidden"
        onClick={() => openComposer(phoneTab)}
      >
        <Plus className="size-6" aria-hidden />
      </Button>

      {/* Desktop: three columns side by side. */}
      <div className="hidden grid-cols-3 items-start gap-4 md:grid">
        {TODO_STATUSES.map((status) => {
          const look = STATUS_LOOK[status];
          const Icon = look.icon;
          const items = inColumn(status);
          return (
            <section key={status} aria-label={look.label} className={`overflow-hidden rounded-2xl ${look.tint}`}>
              <div className={`h-1 ${look.bar}`} aria-hidden />
              <div className="flex flex-col gap-3 p-3">
                <div className="flex items-center gap-2 px-1">
                  <Icon className={`size-4 ${look.iconTone}`} aria-hidden />
                  <h2 className="text-sm font-semibold text-heading">{look.label}</h2>
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
                    {items.length}
                  </span>
                </div>
                {adding === status && <CardComposer status={status} onAdd={add} onClose={closeComposer} />}
                <CardList cards={items} status={status} showEmpty={adding !== status} {...listProps} />
                {adding !== status && (
                  <Button
                    type="button"
                    variant="ghost"
                    data-add-card={status}
                    onClick={() => openComposer(status)}
                    className="justify-start text-muted-foreground hover:bg-card hover:text-heading"
                  >
                    <Plus aria-hidden /> Add a card
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* One card view for the whole board, outside both layouts. */}
      <CardViewDialog
        card={cards.find((c) => c.id === openId) ?? null}
        now={now}
        info={openId ? saver.info[openId] : undefined}
        onEdit={editCard}
        onClose={closeCard}
        onDelete={(id) => removeCard(id)}
        onCloseFocus={() => {
          const run = closeFocus.current;
          closeFocus.current = null;
          if (run) run();
          else if (lastOpened.current) focusCard(lastOpened.current);
        }}
      />
    </>
  );
}

function CardList({
  cards,
  status,
  now,
  showEmpty,
  onOpen,
  onDelete,
}: {
  cards: BoardCard[];
  status: TodoStatus;
  now: string;
  showEmpty: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const look = STATUS_LOOK[status];
  const Icon = look.icon;
  if (cards.length === 0) {
    if (!showEmpty) return null;
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border/80 px-4 py-8 text-center">
        <Icon className={`size-6 ${look.iconTone} opacity-60`} aria-hidden />
        <p className="text-xs text-muted-foreground">{look.empty}</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {cards.map((card) => (
        <li key={card.id}>
          <TodoCardView card={card} now={now} onOpen={onOpen} onDelete={onDelete} />
        </li>
      ))}
    </ul>
  );
}

"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TODO_STATUSES, type TodoStatus } from "@/db/constants";
import { showUndoToast } from "@/lib/undo-toast";
import { useMediaQuery } from "@/lib/use-media-query";
import type { TodoCard } from "@/services/todos/types";
import { BOARD_FULL_MESSAGE, boardRequest } from "@/lib/board-api";
import { CardComposer } from "./card-composer";
import { CardViewDialog } from "./card-view-dialog";
import type { PickedFile } from "./saved-file-picker";
import { ColumnEmpty, moveMessage, TodoCardView, type BoardCard, type MoveHow } from "./todo-card";
import { BoardDnd, DRAG_QUIET_MS, SortableColumn, useActiveColumn } from "./todo-dnd";
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

const sameFile = (a: BoardCard["resource"], b: BoardCard["resource"]) => JSON.stringify(a) === JSON.stringify(b);

// Puts a card back among the cards of its column at `index` (0 = top), wherever the array keeps
// that column's cards.
function insertInColumn(all: BoardCard[], card: BoardCard, index: number): BoardCard[] {
  const column = all.filter((c) => c.status === card.status);
  if (column.length === 0) return [...all, card];
  const at = Math.min(index, column.length);
  const position = at < column.length ? all.indexOf(column[at]) : all.indexOf(column[column.length - 1]) + 1;
  return [...all.slice(0, position), card, ...all.slice(position)];
}

// Where a card goes: out of its column, into `status` at `index` (0 = top). The card keeps its other
// fields; a change of column stamps `changedAt` as the time it entered the column.
function place(all: BoardCard[], id: string, status: TodoStatus, index: number, changedAt?: string): BoardCard[] {
  const card = all.find((c) => c.id === id);
  if (!card) return all;
  const moved = { ...card, status, statusChangedAt: changedAt ?? card.statusChangedAt };
  return insertInColumn(
    all.filter((c) => c.id !== id),
    moved,
    index,
  );
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
  const [celebrating, setCelebrating] = useState<string | null>(null);
  // "Added 5 minutes ago" starts from the server's clock (so the first render matches the HTML)
  // and is refreshed every minute afterwards.
  const [now, setNow] = useState(serverNow);
  const tempCounter = useRef(0);
  // Requests go to the server one after another, so cards land in the order they were added and an
  // Undo is always sent after its delete.
  const queue = useRef<Promise<void>>(Promise.resolve());
  // What the server has for each card, to put back a title it refused.
  const saved = useRef(new Map(initialCards.map((c) => [c.id, { title: c.title, note: c.note, resource: c.resource }])));
  // The newest cards, for moves started from an Undo button whose closure is older than the board.
  const latest = useRef(cards);
  useEffect(() => {
    latest.current = cards;
  });
  // Drag and drop exists on desktop only; a phone moves cards with Start, Done and the menu.
  const desktop = useMediaQuery("(min-width: 768px)");
  const dragGuard = useRef({ active: false, endedAt: 0 });
  const closeFocus = useRef<(() => void) | null>(null);
  const lastOpened = useRef<string | null>(null);
  const saver = useCardSaver({
    onSaved: (card, stillWaiting) => {
      saved.current.set(card.id, { title: card.title, note: card.note, resource: card.resource });
      // The server's answer replaces the file shown, unless a newer choice is still on its way.
      if (!stillWaiting.includes("resourceId")) {
        setCards((all) => all.map((c) => (c.id === card.id && !sameFile(c.resource, card.resource) ? { ...c, resource: card.resource } : c)));
      }
    },
    onSignedOut: () => router.push(SIGN_IN),
    onLinkRefused: (id, newerLink) => {
      if (!newerLink) {
        const back = saved.current.get(id)?.resource ?? null;
        setCards((all) => all.map((c) => (c.id === id ? { ...c, resource: back } : c)));
      }
      toast.error("This file can no longer be linked.");
    },
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
      if (dragGuard.current.active) return;
      event.preventDefault();
      setPhoneTab("todo");
      setAdding("todo");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function add(status: TodoStatus, title: string, file: PickedFile | null = null) {
    const tempId = `pending-${++tempCounter.current}`;
    const stamp = new Date().toISOString();
    const temp: BoardCard = {
      id: tempId, status, position: 0, title, note: "", createdAt: stamp, updatedAt: stamp, statusChangedAt: stamp, resource: file, pending: true,
    };
    setCards((all) => [temp, ...all]);
    const drop = () => setCards((all) => all.filter((c) => c.id !== tempId));

    queue.current = queue.current.then(async () => {
      try {
        const response = await boardRequest("POST", "", file ? { title, status, resourceId: file.id } : { title, status });
        if (response.ok) {
          const { card } = (await response.json()) as { card: TodoCard };
          saved.current.set(card.id, { title: card.title, note: card.note, resource: card.resource });
          setCards((all) => all.map((c) => (c.id === tempId ? card : c)));
        } else if (response.status === 401) {
          drop();
          router.push(SIGN_IN);
        } else if (response.status === 409) {
          drop();
          toast.error(BOARD_FULL_MESSAGE);
        } else if (response.status === 404 && file) {
          drop();
          toast.error("This file can no longer be added.");
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
    // Space picks a card up on desktop; its click (on key release) must not open the card view.
    if (dragGuard.current.active || Date.now() - dragGuard.current.endedAt < DRAG_QUIET_MS) return;
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

  // Links a saved file to a card, or removes the file (`file` null), at once on the board and sent
  // straight away. A card with no title of its own keeps the file's title when the file goes.
  function linkFile(id: string, file: PickedFile | null) {
    const card = latest.current.find((c) => c.id === id);
    if (!card || card.pending) return;
    const change: Edit = { resourceId: file?.id ?? null };
    let title = card.title;
    if (!file && !card.title.trim() && card.resource?.available) {
      title = card.resource.title;
      change.title = title;
    }
    setCards((all) => all.map((c) => (c.id === id ? { ...c, title, resource: file } : c)));
    saver.edit(id, change, { immediate: true });
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
          saved.current.set(card.id, { title: card.title, note: card.note, resource: card.resource });
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

  // Moves a card to `index` of `status` (0 = top) at once, then asks the server; if the server
  // refuses, the card goes back where it was. Every move, except one made by Undo, offers Undo.
  function move(id: string, status: TodoStatus, index: number, how: MoveHow, isUndo = false) {
    const all = latest.current;
    const card = all.find((c) => c.id === id);
    if (!card || card.pending) return;
    const column = all.filter((c) => c.status === card.status);
    const from = column.indexOf(card);
    const size = status === card.status ? column.length - 1 : all.filter((c) => c.status === status).length;
    const to = Math.max(0, Math.min(index, size));
    if (status === card.status && to === from) return;
    const before = { status: card.status, index: from, changedAt: card.statusChangedAt };

    const next = place(all, id, status, to, status === card.status ? undefined : new Date().toISOString());
    latest.current = next;
    setCards(next);
    if (status === "done" && !isUndo) {
      setCelebrating(id);
      setTimeout(() => setCelebrating((current) => (current === id ? null : current)), 700);
    }
    const toastId = isUndo ? null : showUndoToast(how.message, () => move(id, before.status, before.index, how, true));
    if (!how.keepFocus) {
      // After the menu has handed the focus back to its button. The card may have left the tab that
      // is on screen (a phone shows one column); then the tab itself keeps the focus.
      setTimeout(() => (visibleElement(`[data-card-open="${id}"]`) ?? visibleElement('[role="tab"][aria-selected="true"]'))?.focus(), 60);
    }

    queue.current = queue.current.then(async () => {
      const rollback = () => {
        const back = place(latest.current, id, before.status, before.index, before.changedAt);
        latest.current = back;
        setCards(back);
        if (toastId !== null) toast.dismiss(toastId);
      };
      try {
        const response = await boardRequest("POST", `/${id}/move`, { status, index: to });
        if (response.ok) {
          const { card: fresh } = (await response.json()) as { card: TodoCard };
          setCards((current) =>
            current.map((c) => (c.id === id ? { ...c, statusChangedAt: fresh.statusChangedAt, updatedAt: fresh.updatedAt } : c)),
          );
        } else if (response.status === 401) {
          rollback();
          router.push(SIGN_IN);
        } else {
          rollback();
          toast.error("Couldn't move the card. Try again.");
        }
      } catch {
        rollback();
        toast.error("Couldn't move the card. Try again.");
      }
    });
  }

  const inColumn = (status: TodoStatus) => cards.filter((c) => c.status === status);
  const listProps = { now, celebrating, onOpen: openCard, onDelete: (id: string) => removeCard(id, true), onMove: move };

  // The three desktop columns. With `sortable` they are drag and drop targets (inside BoardDnd).
  const columns = (sortable: boolean) => (
    <div className="hidden grid-cols-3 items-start gap-4 md:grid">
      {TODO_STATUSES.map((status) => {
        const items = inColumn(status);
        return (
          <DesktopColumn key={status} status={status} count={items.length}>
            {adding === status && <CardComposer status={status} onAdd={add} onClose={closeComposer} />}
            {sortable ? (
              <SortableColumn cards={items} status={status} showEmpty={adding !== status} {...listProps} />
            ) : (
              <CardList cards={items} status={status} showEmpty={adding !== status} {...listProps} />
            )}
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
          </DesktopColumn>
        );
      })}
    </div>
  );

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
      {desktop ? (
        <BoardDnd cards={cards} now={now} move={move} onActiveChange={(active, quiet) => {
            dragGuard.current = { active, endedAt: quiet ? Date.now() : 0 };
          }}>
          {columns(true)}
        </BoardDnd>
      ) : (
        columns(false)
      )}

      {/* One card view for the whole board, outside both layouts. */}
      <CardViewDialog
        card={cards.find((c) => c.id === openId) ?? null}
        now={now}
        info={openId ? saver.info[openId] : undefined}
        onEdit={editCard}
        onLinkFile={linkFile}
        onClose={closeCard}
        onDelete={(id) => removeCard(id)}
        onMove={(id, status) => move(id, status, 0, { message: moveMessage(status), keepFocus: true })}
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

// One desktop column: the coloured bar, the label with its count and the cards. While a card is
// dragged over it, it gets a ring.
function DesktopColumn({ status, count, children }: { status: TodoStatus; count: number; children: ReactNode }) {
  const look = STATUS_LOOK[status];
  const Icon = look.icon;
  const highlighted = useActiveColumn() === status;
  return (
    <section
      aria-label={look.label}
      className={`overflow-hidden rounded-2xl transition-shadow motion-reduce:transition-none ${look.tint} ${highlighted ? "ring-2 ring-primary" : ""}`}
    >
      <div className={`h-1 ${look.bar}`} aria-hidden />
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2 px-1">
          <Icon className={`size-4 ${look.iconTone}`} aria-hidden />
          <h2 className="text-sm font-semibold text-heading">{look.label}</h2>
          <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">{count}</span>
        </div>
        {children}
      </div>
    </section>
  );
}

function CardList({
  cards,
  status,
  now,
  celebrating,
  showEmpty,
  onOpen,
  onDelete,
  onMove,
}: {
  cards: BoardCard[];
  status: TodoStatus;
  now: string;
  celebrating: string | null;
  showEmpty: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: TodoStatus, index: number, how: MoveHow) => void;
}) {
  if (cards.length === 0) return showEmpty ? <ColumnEmpty status={status} /> : null;
  return (
    <ul className="flex flex-col gap-2.5">
      {cards.map((card, index) => (
        <li key={card.id}>
          <TodoCardView
            card={card}
            now={now}
            index={index}
            count={cards.length}
            celebrating={celebrating === card.id}
            onOpen={onOpen}
            onDelete={onDelete}
            onMove={onMove}
          />
        </li>
      ))}
    </ul>
  );
}

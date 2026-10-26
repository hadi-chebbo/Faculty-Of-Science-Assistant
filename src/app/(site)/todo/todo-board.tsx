"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TODO_MAX_CARDS, TODO_STATUSES, type TodoStatus } from "@/db/constants";
import { renew } from "@/lib/auth/client-session";
import type { TodoCard } from "@/services/todos/types";
import { CardComposer } from "./card-composer";
import { TodoCardView, type BoardCard } from "./todo-card";
import { STATUS_LOOK } from "./todo-status";

const FOCUS_TARGETS = "[data-add-card]";

// Puts the focus back on whichever "add" control is on screen (the column's "Add a card" on
// desktop, the round "+" on a phone) once the composer has gone.
function focusAddControl(status: TodoStatus) {
  setTimeout(() => {
    const visible = [...document.querySelectorAll<HTMLElement>(FOCUS_TARGETS)].filter(
      (el) => el.dataset.addCard === status && el.getClientRects().length > 0,
    );
    visible[0]?.focus();
  });
}

// The signed-in student's board, following variant D of the prototype: three tinted columns on a
// desktop, tabs with one column at a time on a phone. Adding a card is optimistic: it appears at
// the top of its column at once and is replaced by the server's card, or removed with a message.
export function TodoBoard({ initialCards, serverNow }: { initialCards: TodoCard[]; serverNow: string }) {
  const router = useRouter();
  const [cards, setCards] = useState<BoardCard[]>(initialCards);
  const [adding, setAdding] = useState<TodoStatus | null>(null);
  const [phoneTab, setPhoneTab] = useState<TodoStatus>("todo");
  // "Added 5 minutes ago" starts from the server's clock (so the first render matches the HTML)
  // and is refreshed every minute afterwards.
  const [now, setNow] = useState(serverNow);
  const tempCounter = useRef(0);
  // Requests go to the server one after another, so cards land in the order they were added.
  const queue = useRef<Promise<void>>(Promise.resolve());

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

  async function post(status: TodoStatus, title: string): Promise<Response> {
    const run = () =>
      fetch("/api/v1/todos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, status }),
      });
    const first = await run();
    // An expired access token is renewed once, then the request is tried again.
    return first.status === 401 && (await renew()) ? run() : first;
  }

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
        const response = await post(status, title);
        if (response.ok) {
          const { card } = (await response.json()) as { card: TodoCard };
          setCards((all) => all.map((c) => (c.id === tempId ? card : c)));
        } else if (response.status === 401) {
          drop();
          router.push(`/sign-in?next=${encodeURIComponent("/todo")}`);
        } else if (response.status === 409) {
          drop();
          toast.error(`Your board is full (${TODO_MAX_CARDS} cards). Delete some to add more.`);
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

  const inColumn = (status: TodoStatus) => cards.filter((c) => c.status === status);

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
            <CardList cards={inColumn(status)} status={status} now={now} showEmpty={adding !== status} />
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
                <CardList cards={items} status={status} now={now} showEmpty={adding !== status} />
                {adding !== status && (
                  <button
                    type="button"
                    data-add-card={status}
                    onClick={() => openComposer(status)}
                    className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:bg-card hover:text-heading"
                  >
                    <Plus className="size-4" aria-hidden /> Add a card
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function CardList({ cards, status, now, showEmpty }: { cards: BoardCard[]; status: TodoStatus; now: string; showEmpty: boolean }) {
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
          <TodoCardView card={card} now={now} />
        </li>
      ))}
    </ul>
  );
}

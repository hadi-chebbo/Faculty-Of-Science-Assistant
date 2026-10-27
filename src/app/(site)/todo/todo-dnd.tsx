"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type PointerSensorOptions,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { TODO_STATUSES, type TodoStatus } from "@/db/constants";
import { useMediaQuery } from "@/lib/use-media-query";
import { ColumnEmpty, moveMessage, titleOf, TodoCardView, type BoardCard, type MoveHow } from "./todo-card";
import { STATUS_LOOK } from "./todo-status";

type Layout = Record<TodoStatus, string[]>;
type Place = { status: TodoStatus; index: number };
type OnMove = (id: string, status: TodoStatus, index: number, how: MoveHow) => void;

// The board is told when a drag starts and ends, so N and the card view stay quiet meanwhile (the
// Space key's own click arrives just after a keyboard pick-up and drop).
export const DRAG_QUIET_MS = 400;

const DRAG_HELP = "To pick up a card, press Space. Use the arrow keys to move it between columns and up or down, Space to drop it, Escape to cancel.";

const columnId = (status: TodoStatus) => `column:${status}`;
const statusOfColumn = (id: UniqueIdentifier): TodoStatus | null => {
  const text = String(id);
  const status = text.startsWith("column:") ? text.slice(7) : null;
  return TODO_STATUSES.find((s) => s === status) ?? null;
};

const columnsOf = (cards: BoardCard[]): Layout => ({
  todo: cards.filter((c) => c.status === "todo").map((c) => c.id),
  in_progress: cards.filter((c) => c.status === "in_progress").map((c) => c.id),
  done: cards.filter((c) => c.status === "done").map((c) => c.id),
});

const containerOf = (layout: Layout, id: UniqueIdentifier): TodoStatus | null =>
  TODO_STATUSES.find((status) => layout[status].includes(String(id))) ?? null;

// A press starts a drag from anywhere on the card, except on a button or link other than the title
// button (which is stretched over the card): those keep their own behaviour. Touch is left to
// scrolling; a phone has no drag at all.
class CardPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: event }: ReactPointerEvent, { onActivation }: PointerSensorOptions) => {
        if (!event.isPrimary || event.button !== 0 || event.pointerType === "touch") return false;
        const target = event.target instanceof Element ? event.target : null;
        if (!target?.closest("[data-card-drag]")) return false;
        if (target.closest("button, a, input, textarea, select, [role=menu]") && !target.closest("[data-card-open]")) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

type DragContextValue = { layout: Layout | null; cardsById: Map<string, BoardCard>; activeStatus: TodoStatus | null };
const DragContext = createContext<DragContextValue | null>(null);

// Which column is under the dragged card, for the column's highlight; null when nothing is dragged.
export const useActiveColumn = () => useContext(DragContext)?.activeStatus ?? null;

// Drag and drop for the desktop columns. Wraps the three columns; a phone never renders this.
// While a card is dragged the columns show a working copy of the layout (`layout`) so the dashed
// slot moves to where the card will land; a drop goes through the board's own `move`.
export function BoardDnd({
  cards,
  now,
  move,
  onActiveChange,
  children,
}: {
  cards: BoardCard[];
  now: string;
  move: OnMove;
  onActiveChange: (active: boolean, quiet?: boolean) => void;
  children: ReactNode;
}) {
  const dndId = useId();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [layout, setLayoutState] = useState<Layout | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  const start = useRef<Place | null>(null);
  const dropped = useRef<(Place & { total: number }) | null>(null);
  const byKeyboard = useRef(false);
  const cardsById = new Map(cards.map((c) => [c.id, c]));
  const cardsRef = useRef(cardsById);
  useEffect(() => {
    cardsRef.current = cardsById;
  });

  const setLayout = useCallback((next: Layout | null) => {
    layoutRef.current = next;
    setLayoutState(next);
  }, []);

  const sensors = useSensors(
    useSensor(CardPointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  // A card in a non-empty column is found among that column's cards, not as the column itself.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const hits = closestCorners(args);
    const status = hits[0] ? statusOfColumn(hits[0].id) : null;
    const ids = status ? layoutRef.current?.[status] : undefined;
    if (ids?.length) {
      const inner = closestCorners({ ...args, droppableContainers: args.droppableContainers.filter((c) => ids.includes(String(c.id))) });
      if (inner.length) return inner;
    }
    return hits;
  }, []);

  const title = (id: UniqueIdentifier) => {
    const card = cardsRef.current.get(String(id));
    return card ? titleOf(card) : "card";
  };
  const labelOf = (status: TodoStatus) => STATUS_LOOK[status].label;
  const placeText = (status: TodoStatus, position: number, total?: number) =>
    `${labelOf(status)}, position ${position}${total === undefined ? "" : ` of ${total}`}`;

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const now = layoutRef.current;
      const status = now ? containerOf(now, active.id) : null;
      return status && now ? `Picked up ${title(active.id)}. ${placeText(status, now[status].indexOf(String(active.id)) + 1, now[status].length)}.` : undefined;
    },
    onDragOver: ({ active, over }) => {
      const now = layoutRef.current;
      const status = now ? containerOf(now, active.id) : null;
      if (!over || !now || !status) return undefined;
      const ids = now[status];
      const overIndex = ids.indexOf(String(over.id));
      const position = overIndex >= 0 ? overIndex + 1 : ids.indexOf(String(active.id)) + 1;
      return `${title(active.id)} is over ${labelOf(status)}, position ${position} of ${ids.length}.`;
    },
    onDragEnd: ({ active }) => {
      const place = dropped.current;
      return place ? `Dropped ${title(active.id)} in ${labelOf(place.status)}, position ${place.index + 1} of ${place.total}.` : undefined;
    },
    onDragCancel: ({ active }) => {
      const from = start.current;
      return from ? `Cancelled. ${title(active.id)} went back to ${labelOf(from.status)}, position ${from.index + 1}.` : undefined;
    },
  };

  function onDragStart({ active, activatorEvent }: DragStartEvent) {
    const id = String(active.id);
    const now = columnsOf([...cardsRef.current.values()]);
    const status = containerOf(now, id);
    start.current = status ? { status, index: now[status].indexOf(id) } : null;
    dropped.current = null;
    byKeyboard.current = activatorEvent instanceof KeyboardEvent;
    onActiveChange(true);
    setActiveId(id);
    setLayout(now);
  }

  // Dragged over another column: the card joins it at once, so the slot moves there.
  function onDragOver({ active, over }: DragOverEvent) {
    const now = layoutRef.current;
    if (!now || !over) return;
    const id = String(active.id);
    const from = containerOf(now, id);
    const to = statusOfColumn(over.id) ?? containerOf(now, over.id);
    if (!from || !to || from === to) return;
    const target = now[to];
    let index = target.length;
    if (!statusOfColumn(over.id)) {
      const translated = active.rect.current.translated;
      const below = translated ? translated.top > over.rect.top + over.rect.height / 2 : false;
      index = target.indexOf(String(over.id)) + (below ? 1 : 0);
    }
    setLayout({ ...now, [from]: now[from].filter((x) => x !== id), [to]: [...target.slice(0, index), id, ...target.slice(index)] });
  }

  // `quiet`: a drop, whose key release may still click the card; a cancel (Esc) leaves nothing behind.
  function finish(quiet: boolean) {
    onActiveChange(false, quiet);
    setActiveId(null);
    setLayout(null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const now = layoutRef.current;
    const from = start.current;
    const id = String(active.id);
    const keyboard = byKeyboard.current;
    finish(true);
    const status = now ? containerOf(now, id) : null;
    if (!now || !from || !status) return;
    const ids = now[status];
    let index = ids.indexOf(id);
    if (over) {
      const overIndex = statusOfColumn(over.id) ? ids.length - 1 : ids.indexOf(String(over.id));
      if (overIndex >= 0 && overIndex !== index) index = overIndex;
    }
    dropped.current = { status, index, total: ids.length };
    if (status === from.status && index === from.index) {
      if (keyboard) refocus(id);
      return;
    }
    const message = status !== from.status ? moveMessage(status) : index < from.index ? "Moved up" : "Moved down";
    move(id, status, index, { message, keepFocus: !keyboard });
  }

  function onDragCancel({ active }: DragCancelEvent) {
    const keyboard = byKeyboard.current;
    finish(false);
    if (keyboard) refocus(String(active.id));
  }

  const activeCard = activeId ? cardsById.get(activeId) : undefined;
  const value: DragContextValue = {
    layout,
    cardsById,
    activeStatus: layout && activeId ? containerOf(layout, activeId) : null,
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{ announcements, screenReaderInstructions: { draggable: DRAG_HELP } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <DragContext.Provider value={value}>{children}</DragContext.Provider>
      <DragOverlay dropAnimation={reduceMotion ? null : undefined}>
        {activeCard && (
          // The tilt is on the inner element, so the box dnd-kit measures for keyboard moves is not rotated.
          <div inert aria-hidden className="cursor-grabbing">
            <div className="rounded-xl shadow-2xl ring-1 ring-foreground/10 motion-safe:rotate-2">
              <TodoCardView
                card={activeCard}
                now={now}
                index={0}
                count={1}
                celebrating={false}
                overlay
                onOpen={() => {}}
                onDelete={() => {}}
                onMove={() => {}}
              />
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function refocus(id: string) {
  setTimeout(() => {
    const found = [...document.querySelectorAll<HTMLElement>(`[data-card-open="${id}"]`)].find((el) => el.getClientRects().length > 0);
    found?.focus();
  }, 60);
}

// One column's cards on desktop: sortable, and a drop target even when empty.
export function SortableColumn({
  status,
  cards,
  showEmpty,
  now,
  celebrating,
  onOpen,
  onDelete,
  onMove,
}: {
  status: TodoStatus;
  cards: BoardCard[];
  showEmpty: boolean;
  now: string;
  celebrating: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: OnMove;
}) {
  const drag = useContext(DragContext);
  const { setNodeRef } = useDroppable({ id: columnId(status) });
  const shown = drag?.layout ? drag.layout[status].flatMap((id) => drag.cardsById.get(id) ?? []) : cards;
  return (
    <div ref={setNodeRef} className="flex min-h-16 flex-col gap-3">
      <SortableContext items={shown.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        {shown.length === 0 ? (
          showEmpty && <ColumnEmpty status={status} />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {shown.map((card, index) => (
              <SortableCard
                key={card.id}
                card={card}
                now={now}
                index={index}
                count={shown.length}
                celebrating={celebrating === card.id}
                onOpen={onOpen}
                onDelete={onDelete}
                onMove={onMove}
              />
            ))}
          </ul>
        )}
      </SortableContext>
    </div>
  );
}

function SortableCard({
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
  onMove: OnMove;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: card.pending === true,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="relative rounded-xl motion-reduce:transition-none!"
      {...listeners}
    >
      {isDragging && <div aria-hidden className="absolute inset-0 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5" />}
      <div className={isDragging ? "pointer-events-none opacity-0" : undefined}>
        <TodoCardView
          card={card}
          now={now}
          index={index}
          count={count}
          celebrating={celebrating}
          onOpen={onOpen}
          onDelete={onDelete}
          onMove={onMove}
          drag={
            card.pending
              ? undefined
              : {
                  attributes: {
                    "aria-roledescription": attributes["aria-roledescription"],
                    "aria-describedby": attributes["aria-describedby"],
                  },
                  activatorRef: setActivatorNodeRef,
                }
          }
        />
      </div>
    </li>
  );
}

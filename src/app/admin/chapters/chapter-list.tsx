"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHAPTER_COUNT_MAX, CHAPTER_TITLE_MAX_LENGTH } from "@/db/constants";
import { adminFetch } from "@/lib/admin-fetch";
import type { AdminChapterWithCount } from "@/services/chapters/types";
import { SortableChapterItem } from "./sortable-chapter-item";

const TITLE_MESSAGE = `Enter a title of 1 to ${CHAPTER_TITLE_MAX_LENGTH} characters.`;
const GENERAL_MESSAGE = "Something went wrong. Please try again.";
const BUTTON = "h-11 px-3 md:h-9";
const ICON_BUTTON = "size-11 md:size-9";

type Where = "add" | "rename" | "row";
type Failure = { where: Where; message: string };

// Dragging only moves up and down.
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const itemsText = (n: number) => (n === 0 ? "Empty" : `${n} ${n === 1 ? "item" : "items"}`);

// The chapters of one course with their controls. Every change goes through the API, then the
// server page is refreshed, so the list and counts always come from the database.
export function ChapterList({
  courseId,
  courseCode,
  chapters,
}: {
  courseId: string;
  courseCode: string;
  chapters: AdminChapterWithCount[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState<AdminChapterWithCount | null>(null);
  // The order just dropped, shown until the refreshed `chapters` arrive (or the save fails).
  const [dropped, setDropped] = useState<string[] | null>(null);
  const [seen, setSeen] = useState(chapters);
  if (seen !== chapters) {
    setSeen(chapters);
    setDropped(null);
  }
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Sends one change. Returns true when it was saved (and the page refreshed).
  async function send(url: string, method: string, body: unknown, where: Where): Promise<boolean> {
    setPending(true);
    setFailure(null);
    try {
      const response = await adminFetch(
        url,
        {
          method,
          ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
        },
        () => router.replace("/sign-in"),
      );
      if (response.ok) {
        router.refresh();
        setPending(false);
        return true;
      }
      if (response.status === 401) {
        setFailure({ where: "row", message: "Your session has ended. Redirecting to sign in." });
        return false;
      }
      const data: { fields?: unknown } = response.status === 400 ? await response.json().catch(() => ({})) : {};
      const fields = Array.isArray(data.fields) ? data.fields : [];
      if (fields.includes("title")) setFailure({ where, message: TITLE_MESSAGE });
      else if (fields.includes("chapters")) {
        setFailure({ where, message: `This course already has ${CHAPTER_COUNT_MAX} chapters.` });
      } else setFailure({ where: "row", message: GENERAL_MESSAGE });
    } catch {
      setFailure({ where: "row", message: "Could not reach the server. Check your connection and try again." });
    }
    setPending(false);
    return false;
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (await send(`/api/v1/courses/${courseId}/chapters`, "POST", { title: addTitle }, "add")) setAddTitle("");
  }

  async function onRename(event: FormEvent) {
    event.preventDefault();
    if (renaming && (await send(`/api/v1/chapters/${renaming.id}`, "PUT", { title: renaming.title }, "rename"))) {
      setRenaming(null);
    }
  }

  function cancelRename() {
    setRenaming(null);
    setFailure(null);
  }

  function onRenameKey(event: KeyboardEvent) {
    if (event.key === "Escape") cancelRename();
  }

  // Positions keep the numbers the server gave; a drop only changes who holds them.
  const positions = chapters.map((chapter) => chapter.position);
  const shown = dropped
    ? dropped.flatMap((id) => chapters.find((chapter) => chapter.id === id) ?? [])
    : chapters;
  const dragDisabled = pending || renaming !== null || shown.length < 2;
  const titleOf = (id: unknown) => shown.find((chapter) => chapter.id === id)?.title ?? "chapter";
  const placeOf = (id: unknown) => `position ${shown.findIndex((chapter) => chapter.id === id) + 1} of ${shown.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}, ${placeOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${titleOf(active.id)} is over ${titleOf(over.id)}, ${placeOf(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over ? `Dropped ${titleOf(active.id)} at ${placeOf(over.id)}.` : `Dropped ${titleOf(active.id)}. Nothing changed.`,
    onDragCancel: ({ active }) => `Cancelled. ${titleOf(active.id)} is back at ${placeOf(active.id)}.`,
  };

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = shown.findIndex((chapter) => chapter.id === active.id);
    const to = shown.findIndex((chapter) => chapter.id === over.id);
    if (from < 0 || to < 0) return;
    const ids = arrayMove(shown, from, to).map((chapter) => chapter.id);
    setDropped(ids);
    const saved = await send(`/api/v1/courses/${courseId}/chapters/order`, "PUT", { chapterIds: ids }, "row");
    if (!saved) setDropped(null);
  }

  function move(index: number, by: -1 | 1) {
    const ids = shown.map((chapter) => chapter.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    void send(`/api/v1/courses/${courseId}/chapters/order`, "PUT", { chapterIds: ids }, "row");
  }

  async function onDelete() {
    if (deleting) await send(`/api/v1/chapters/${deleting.id}`, "DELETE", undefined, "row");
    setDeleting(null);
  }

  const error = (where: Where) => (failure?.where === where ? failure.message : null);

  return (
    <div className="space-y-6">
      {shown.length === 0 ? (
        <p className="rounded-lg border bg-card p-4">This course has no chapters yet.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[verticalOnly]}
          accessibility={{ announcements }}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={shown.map((chapter) => chapter.id)} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2" aria-label="Chapters">
          {shown.map((chapter, index) => (
            <SortableChapterItem
              key={chapter.id}
              id={chapter.id}
              title={chapter.title}
              disabled={dragDisabled}
              showHandle={renaming?.id !== chapter.id}
            >
              {(handle) => renaming?.id === chapter.id ? (
                <form onSubmit={onRename} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-8 shrink-0 font-semibold text-heading">{chapter.position}</span>
                    <Input
                      aria-label={`New title for ${chapter.title}`}
                      aria-invalid={error("rename") ? true : undefined}
                      value={renaming.title}
                      onChange={(event) => setRenaming({ id: chapter.id, title: event.target.value })}
                      onKeyDown={onRenameKey}
                      className="h-11 min-w-0 flex-1 basis-[calc(100%-2.5rem)] md:h-9 md:basis-48"
                      autoFocus
                    />
                    <Button type="submit" disabled={pending} className={`${BUTTON} ml-10 md:ml-0`}>Save</Button>
                    <Button type="button" variant="outline" disabled={pending} className={BUTTON} onClick={cancelRename}>
                      Cancel
                    </Button>
                  </div>
                  {error("rename") && (
                    <p role="alert" className="pl-10 text-sm font-medium text-destructive">{error("rename")}</p>
                  )}
                </form>
              ) : (
                <div className="grid grid-cols-[auto_2rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 md:grid-cols-[auto_2rem_minmax(0,1fr)_5rem_auto] md:gap-x-4">
                  {handle}
                  <span className="font-semibold text-heading">{positions[index]}</span>
                  <span className="min-w-0 break-words font-medium text-heading">{chapter.title}</span>
                  <span className="col-start-3 text-sm md:col-start-4">{itemsText(chapter.itemCount)}</span>
                  <div className="col-start-3 mt-2 flex flex-wrap items-center gap-2 md:col-start-5 md:mt-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={ICON_BUTTON}
                      aria-label={`Move ${chapter.title} up`}
                      disabled={pending || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={ICON_BUTTON}
                      aria-label={`Move ${chapter.title} down`}
                      disabled={pending || index === chapters.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={`${BUTTON} ml-auto md:ml-4`}
                      aria-label={`Rename ${chapter.title}`}
                      disabled={pending}
                      onClick={() => {
                        setFailure(null);
                        setRenaming({ id: chapter.id, title: chapter.title });
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={BUTTON}
                      aria-label={`Delete ${chapter.title}`}
                      disabled={pending}
                      onClick={() => setDeleting(chapter)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </SortableChapterItem>
          ))}
        </ol>
          </SortableContext>
        </DndContext>
      )}
      {error("row") && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error("row")}
        </p>
      )}

      <form onSubmit={onAdd} className="space-y-2 rounded-lg border bg-card p-3">
        <label htmlFor="new-chapter-title" className="block text-sm font-medium text-heading">Add a chapter</label>
        <div className="flex flex-wrap items-start gap-2">
          <Input
            id="new-chapter-title"
            placeholder="Chapter title"
            value={addTitle}
            onChange={(event) => setAddTitle(event.target.value)}
            aria-invalid={error("add") ? true : undefined}
            aria-describedby={error("add") ? "new-chapter-error" : undefined}
            className="h-11 min-w-0 flex-1 basis-56 md:h-9"
          />
          <Button type="submit" disabled={pending} className={BUTTON}>Add</Button>
        </div>
        {error("add") && (
          <p id="new-chapter-error" role="alert" className="text-sm font-medium text-destructive">{error("add")}</p>
        )}
      </form>

      <Link
        href={`/courses/${courseCode}`}
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline md:min-h-9"
      >
        View the course page &rarr;
      </Link>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && !pending && setDeleting(null)}>
        <AlertDialogContent {...(deleting && deleting.itemCount > 0 ? {} : { "aria-describedby": undefined })}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleting?.title}&rdquo;?</AlertDialogTitle>
            {deleting && deleting.itemCount > 0 && (
              <AlertDialogDescription>
                Its {deleting.itemCount} {deleting.itemCount === 1 ? "item is" : "items are"} kept. They move to
                &ldquo;Other material&rdquo; on the course page.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                void onDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

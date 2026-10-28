import { toast } from "sonner";
import { showUndoToast } from "@/lib/undo-toast";
import type { MarkResult, Rewards } from "@/services/progress/types";

// What finishing something looks like in the browser. The server decides (`rewards` in the mark
// response); this module only presents it, so any page that marks a file (the reader now, the
// to-do board later) calls `celebrate` with the same result. Nothing here is stored.

// How long the chapter toast stays: longer than a plain Undo, so "Next chapter" is reachable.
const CHAPTER_TOAST_MS = 8000;

type Listener = () => void;

// A tiny store: a state, a subscribe for useSyncExternalStore, and a setter.
function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(next: T) {
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// The course dialog: one host mounted in SiteChrome shows whatever is put here.
export type CourseCelebration = NonNullable<Rewards["courseFinished"]>;
export interface CelebrationDialogState {
  course: CourseCelebration;
  // Where focus goes when the dialog closes; the host falls back to the default when it returns null.
  focusTarget: () => HTMLElement | null;
}
export const celebrationDialog = createStore<CelebrationDialogState | null>(null);

// A nonce per resource: each increase plays the Done button's ring once.
export const pulses = createStore<ReadonlyMap<string, number>>(new Map());

function pulse(resourceId: string): void {
  const next = new Map(pulses.get());
  next.set(resourceId, (next.get(resourceId) ?? 0) + 1);
  pulses.set(next);
}

// The Done button carries this attribute so a closing dialog can give focus back to it.
export const doneButtonSelector = (resourceId: string) => `[data-done-button="${resourceId}"]`;

export interface CelebrateOptions {
  // The file that was marked.
  resourceId: string;
  undo: () => void;
  // The caller's router push, for "Next chapter".
  navigate: (href: string) => void;
  // Where focus returns after the course dialog; default is the reader's Done button.
  focusTarget?: () => HTMLElement | null;
  // "Marked as done. Chapter 2: 4 of 5." and so on, built by the caller (it knows the wording).
  message: string;
}

// Shows what a new mark earned, in order: course finished (the plain toast and the dialog), chapter
// finished (one toast with Undo and "Next chapter ›", and a ring on the Done button), otherwise the
// plain toast. Milestone toasts are the caller's, after this.
export function celebrate(result: Pick<MarkResult, "progress" | "rewards">, options: CelebrateOptions): void {
  const { courseFinished, chapterFinished } = result.rewards;
  const { resourceId, undo, navigate, message } = options;
  if (courseFinished) {
    showUndoToast(message, undo);
    celebrationDialog.set({
      course: courseFinished,
      focusTarget: options.focusTarget ?? (() => document.querySelector<HTMLElement>(doneButtonSelector(resourceId))),
    });
  } else if (chapterFinished) {
    const next = chapterFinished.nextChapter;
    // The count and the course code come from the progress the same response carries.
    const total = result.progress.chapter?.total ?? 0;
    const code = result.progress.course.code;
    toast(`Chapter ${chapterFinished.position} finished!`, {
      description: `${chapterFinished.title}, all ${total} files done.`,
      classNames: { title: "font-semibold" },
      duration: CHAPTER_TOAST_MS,
      action: { label: "Undo", onClick: undo },
      ...(next ? { cancel: { label: "Next chapter ›", onClick: () => navigate(`/courses/${encodeURIComponent(code)}/chapters/${next.position}`) } } : {}),
    });
    pulse(resourceId);
  } else {
    showUndoToast(message, undo);
  }
}

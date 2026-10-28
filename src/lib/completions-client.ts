"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { askMe, renew } from "@/lib/auth/client-session";
import { SESSION_CHANGED_EVENT } from "@/lib/auth/session-events";
import { showUndoToast } from "@/lib/undo-toast";
import type { Progress } from "@/services/progress/types";

// Which files the signed-in user has marked as done, in the browser: the twin of the saved store
// (`saved-client.ts`). Public pages never read the session on the server, so the browser asks once
// after load (`GET /api/v1/completions/ids`), and every Mark as done control on the page shares
// that answer, so toggling one updates the others. Opening or downloading a file never marks it.

type Store = {
  // unknown: not asked yet (or the answer failed). signed-out: the server said 401, even after a
  // renew. ready: `ids` is the user's completed list.
  status: "unknown" | "signed-out" | "ready";
  ids: ReadonlySet<string>;
  pending: ReadonlySet<string>;
  // The progress the last mark or un-mark of a file answered with, by file id.
  progress: ReadonlyMap<string, Progress>;
};

export type DoneStatus = "unknown" | "signed-out" | "done" | "not-done";

const UNKNOWN: Store = { status: "unknown", ids: new Set(), pending: new Set(), progress: new Map() };
let store: Store = UNKNOWN;
let loading: Promise<void> | null = null;
let watching = false;
const listeners = new Set<() => void>();

function set(next: Partial<Store>): void {
  store = { ...store, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Runs a request; on 401 renews the session once (through the shared lock) and retries. Admin
// pages renew by themselves.
async function request(run: () => Promise<Response>): Promise<Response> {
  const first = await run();
  if (first.status !== 401 || window.location.pathname.startsWith("/admin")) return first;
  return (await renew()) ? run() : first;
}

function load(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      try {
        // Ask who is signed in first, so a visitor never makes the request at all.
        const me = await askMe();
        if (!me.user && (!me.renewable || !(await renew()))) {
          set({ status: "signed-out", ids: new Set() });
          return;
        }
        const response = await request(() => fetch("/api/v1/completions/ids", { cache: "no-store" }));
        if (response.status === 401) set({ status: "signed-out", ids: new Set() });
        else if (response.ok) set({ status: "ready", ids: new Set(((await response.json()) as { ids: string[] }).ids) });
      } catch {
        // Offline or a server error: stay unknown; the next use asks again.
      }
    })().finally(() => {
      loading = null;
    });
  }
  return loading;
}

function ensureLoaded(): void {
  if (!watching) {
    watching = true;
    // Signing in or out changes the answer.
    window.addEventListener(SESSION_CHANGED_EVENT, () => {
      set({ ...UNKNOWN });
      void load();
    });
  }
  if (store.status === "unknown") void load();
}

function withId(set_: ReadonlySet<string>, id: string, present: boolean): ReadonlySet<string> {
  const next = new Set(set_);
  if (present) next.add(id);
  else next.delete(id);
  return next;
}

// "Marked as done. Chapter 2: 4 of 5." for a file in a chapter, otherwise "Marked as done."
function markedMessage(progress: Progress | null): string {
  const chapter = progress?.chapter;
  return chapter ? `Marked as done. Chapter ${chapter.position}: ${chapter.done} of ${chapter.total}.` : "Marked as done.";
}

// Optimistic: the state changes at once and is put back, with a message, if the server refuses.
// A change made by Undo shows no second Undo.
async function change(resourceId: string, done: boolean, undoable: boolean): Promise<"done" | "signed-out"> {
  set({ ids: withId(store.ids, resourceId, done), pending: withId(store.pending, resourceId, true) });
  const failed = done ? "Couldn't mark it as done. Try again." : "Couldn't mark it as not done. Try again.";
  const fail = (message: string) => {
    set({ ids: withId(store.ids, resourceId, !done) });
    toast.error(message);
  };
  try {
    const response = await request(() =>
      fetch(`/api/v1/completions/${encodeURIComponent(resourceId)}`, { method: done ? "PUT" : "DELETE" }),
    );
    if (response.status === 401) {
      set({ status: "signed-out", ids: new Set() });
      return "signed-out";
    }
    if (response.ok) {
      const { progress } = (await response.json()) as { progress: Progress | null };
      const nextProgress = new Map(store.progress);
      if (progress) nextProgress.set(resourceId, progress);
      else nextProgress.delete(resourceId);
      set({ progress: nextProgress });
      if (undoable) {
        showUndoToast(done ? markedMessage(progress) : "Marked as not done.", () => void undo(resourceId, !done));
      }
    } else if (response.status === 404 && done) fail("This file can't be marked as done.");
    else fail(failed);
  } catch {
    fail(failed);
  } finally {
    set({ pending: withId(store.pending, resourceId, false) });
  }
  return "done";
}

// Undo puts the earlier state back, unless the file has been toggled again since (or is being).
async function undo(resourceId: string, done: boolean): Promise<void> {
  if (store.pending.has(resourceId) || store.status !== "ready" || store.ids.has(resourceId) === done) return;
  await change(resourceId, done, false);
}

// The done state of one file, the progress its last mark answered with, and a toggle. Signed out,
// the toggle goes to sign-in and back to this page; nothing is marked automatically afterwards.
// `markable` false (a solution or other file): nothing is asked of the server.
export function useDoneResource(
  resourceId: string,
  markable = true,
): {
  status: DoneStatus;
  pending: boolean;
  progress: Progress | null;
  toggle: () => Promise<void>;
} {
  const router = useRouter();
  const snapshot = useSyncExternalStore(subscribe, () => store, () => UNKNOWN);
  useEffect(() => {
    if (markable) ensureLoaded();
  }, [markable]);

  const goToSignIn = useCallback(() => {
    const here = window.location.pathname + window.location.search;
    router.push(`/sign-in?next=${encodeURIComponent(here)}`);
  }, [router]);

  const toggle = useCallback(async () => {
    if (store.pending.has(resourceId)) return;
    // Pressed before the answer arrived: wait for it.
    if (store.status === "unknown") await load();
    if (store.status === "unknown") {
      toast.error("Couldn't reach the server. Try again.");
      return;
    }
    if (store.status === "signed-out") return goToSignIn();
    if ((await change(resourceId, !store.ids.has(resourceId), true)) === "signed-out") goToSignIn();
  }, [resourceId, goToSignIn]);

  const status: DoneStatus =
    snapshot.status === "ready" ? (snapshot.ids.has(resourceId) ? "done" : "not-done") : snapshot.status;
  return {
    status,
    pending: snapshot.pending.has(resourceId),
    progress: snapshot.status === "ready" ? (snapshot.progress.get(resourceId) ?? null) : null,
    toggle,
  };
}

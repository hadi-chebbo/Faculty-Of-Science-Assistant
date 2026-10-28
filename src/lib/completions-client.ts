"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { MILESTONE_LABELS, type MilestoneKey } from "@/db/constants";
import { askMe, renew } from "@/lib/auth/client-session";
import { SESSION_CHANGED_EVENT } from "@/lib/auth/session-events";
import { showUndoToast } from "@/lib/undo-toast";
import type { Progress, Rewards } from "@/services/progress/types";

// Which files the signed-in user has marked as done, in the browser: the twin of the saved store
// (`saved-client.ts`). Public pages never read the session on the server, so the browser asks once
// after load (`GET /api/v1/completions/ids`), and every Mark as done control on the page shares
// that answer, so toggling one updates the others. Opening or downloading a file never marks it.

type Store = {
  // unknown: not asked yet (or the answer failed). signed-out: the server said 401, even after a
  // renew. signed-in: known to be signed in, the ids are not back yet (rows reserve their cell).
  // ready: `ids` is the user's completed list.
  status: "unknown" | "signed-out" | "signed-in" | "ready";
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
        set({ status: "signed-in" });
        const response = await request(() => fetch("/api/v1/completions/ids", { cache: "no-store" }));
        if (response.status === 401) set({ status: "signed-out", ids: new Set() });
        else if (response.ok) set({ status: "ready", ids: new Set(((await response.json()) as { ids: string[] }).ids) });
        else set({ status: "unknown" });
      } catch {
        // Offline or a server error: back to unknown; the next use asks again.
        if (store.status === "signed-in") set({ status: "unknown" });
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

// One toast per milestone the mark earned, after the mark's own Undo toast. The server returns a
// key only the first time, so each shows once without anything kept in the browser. An Undo never
// takes a milestone away. `navigate` is the caller's router push, so "View" works wherever the mark
// was made (the reader now, the board later).
function showMilestones(keys: readonly MilestoneKey[], navigate: (href: string) => void): void {
  for (const key of keys) {
    toast(`Milestone: ${MILESTONE_LABELS[key]}`, { action: { label: "View", onClick: () => navigate("/progress") } });
  }
}

// Optimistic: the state changes at once and is put back, with a message, if the server refuses.
// A change made by Undo shows no second Undo. `navigate` is needed only for a mark's milestone toasts.
async function change(
  resourceId: string,
  done: boolean,
  undoable: boolean,
  navigate: (href: string) => void = (href) => window.location.assign(href),
): Promise<"done" | "signed-out"> {
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
      const { progress, rewards } = (await response.json()) as { progress: Progress | null; rewards?: Rewards };
      const nextProgress = new Map(store.progress);
      if (progress) nextProgress.set(resourceId, progress);
      else nextProgress.delete(resourceId);
      set({ progress: nextProgress });
      if (undoable) {
        showUndoToast(done ? markedMessage(progress) : "Marked as not done.", () => void undo(resourceId, !done));
      }
      if (rewards) showMilestones(rewards.milestones, navigate);
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
    if (store.status === "unknown" || store.status === "signed-in") await load();
    if (store.status === "unknown" || store.status === "signed-in") {
      toast.error("Couldn't reach the server. Try again.");
      return;
    }
    if (store.status === "signed-out") return goToSignIn();
    if ((await change(resourceId, !store.ids.has(resourceId), true, router.push)) === "signed-out") goToSignIn();
  }, [resourceId, goToSignIn, router]);

  const status: DoneStatus =
    snapshot.status === "ready"
      ? snapshot.ids.has(resourceId)
        ? "done"
        : "not-done"
      : snapshot.status === "signed-in"
        ? "unknown"
        : snapshot.status;
  return {
    status,
    pending: snapshot.pending.has(resourceId),
    progress: snapshot.status === "ready" ? (snapshot.progress.get(resourceId) ?? null) : null,
    toggle,
  };
}

// What a resource row's status cell shows. visitor or unknown: none (no cell at all). Signed in
// with the ids still loading: reserved (an empty cell of the same width). Otherwise done or
// not-done. Every row shares the one ids request; a visitor never makes it.
export type DoneCell = "none" | "reserved" | "done" | "not-done";

export function useDoneCell(resourceId: string): DoneCell {
  const snapshot = useSyncExternalStore(subscribe, () => store, () => UNKNOWN);
  useEffect(() => {
    ensureLoaded();
  }, []);
  if (snapshot.status === "signed-in") return "reserved";
  if (snapshot.status === "ready") return snapshot.ids.has(resourceId) ? "done" : "not-done";
  return "none";
}

// Whether the viewer is known to be signed in (the ids may still be on their way). Other browser
// stores wait on this instead of asking who is signed in again.
export function useKnownSignedIn(): boolean {
  const snapshot = useSyncExternalStore(subscribe, () => store, () => UNKNOWN);
  useEffect(() => {
    ensureLoaded();
  }, []);
  return snapshot.status === "signed-in" || snapshot.status === "ready";
}

// Fetch with the store's renew-on-401 behaviour.
export const requestWithRenew = request;

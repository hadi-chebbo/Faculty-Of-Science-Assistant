"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { askMe, renew } from "@/lib/auth/client-session";
import { SESSION_CHANGED_EVENT } from "@/lib/auth/session-events";

// The saved state of the signed-in user, in the browser. Public pages never read the session on
// the server, so the browser asks once after load (`GET /api/v1/saved/ids`) and every save control
// on the page shares that one answer and one copy of the state, so toggling one updates the others.

type Store = {
  // unknown: not asked yet (or the answer failed). signed-out: the server said 401, even after a
  // renew. ready: `ids` is the user's saved list.
  status: "unknown" | "signed-out" | "ready";
  ids: ReadonlySet<string>;
  pending: ReadonlySet<string>;
};

export type SavedStatus = "unknown" | "signed-out" | "saved" | "not-saved";

const UNKNOWN: Store = { status: "unknown", ids: new Set(), pending: new Set() };
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

// Runs a request; on 401 renews the session once (through the same lock as the account control,
// so no extra refresh token is used) and retries. Admin pages renew by themselves.
async function request(run: () => Promise<Response>): Promise<Response> {
  const first = await run();
  if (first.status !== 401 || window.location.pathname.startsWith("/admin")) return first;
  return (await renew()) ? run() : first;
}

function load(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      try {
        // Ask who is signed in first, so an anonymous visitor never makes a request that fails
        // with 401 (the browser logs those as errors). A renewable session is renewed first.
        const me = await askMe();
        if (!me.user && (!me.renewable || !(await renew()))) {
          set({ status: "signed-out", ids: new Set() });
          return;
        }
        const response = await request(() => fetch("/api/v1/saved/ids", { cache: "no-store" }));
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
      set({ status: "unknown", ids: new Set(), pending: new Set() });
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

// Optimistic: the state changes at once and is put back, with a message, if the server refuses.
async function change(resourceId: string, save: boolean): Promise<"done" | "signed-out"> {
  set({ ids: withId(store.ids, resourceId, save), pending: withId(store.pending, resourceId, true) });
  const fail = (message: string) => {
    set({ ids: withId(store.ids, resourceId, !save) });
    toast.error(message);
  };
  try {
    const response = await request(() =>
      fetch(`/api/v1/saved/${encodeURIComponent(resourceId)}`, { method: save ? "PUT" : "DELETE" }),
    );
    if (response.status === 401) {
      set({ status: "signed-out", ids: new Set() });
      return "signed-out";
    }
    if (response.ok) toast.success(save ? "Saved. Find it under Saved in your account menu." : "Removed from saved.");
    else if (response.status === 404 && save) fail("This file can't be saved.");
    else fail(save ? "Couldn't save. Try again." : "Couldn't remove. Try again.");
  } catch {
    fail(save ? "Couldn't save. Try again." : "Couldn't remove. Try again.");
  } finally {
    set({ pending: withId(store.pending, resourceId, false) });
  }
  return "done";
}

// For a list built on the server from the saved list (the Saved page): true once the store knows
// the user's saved ids and this one is not among them. Until then the server list is trusted.
export function useSavedLookup(): { isRemoved: (resourceId: string) => boolean } {
  const snapshot = useSyncExternalStore(subscribe, () => store, () => UNKNOWN);
  useEffect(ensureLoaded, []);
  return { isRemoved: (resourceId) => snapshot.status === "ready" && !snapshot.ids.has(resourceId) };
}

// The saved state of one resource, and a toggle. Signed out, the toggle goes to sign-in and back
// to this page; nothing is saved automatically afterwards.
export function useSavedResource(resourceId: string): {
  status: SavedStatus;
  pending: boolean;
  toggle: () => Promise<void>;
} {
  const router = useRouter();
  const snapshot = useSyncExternalStore(subscribe, () => store, () => UNKNOWN);
  useEffect(ensureLoaded, []);

  const goToSignIn = useCallback(() => {
    const here = window.location.pathname + window.location.search;
    router.push(`/sign-in?next=${encodeURIComponent(here)}`);
  }, [router]);

  const toggle = useCallback(async () => {
    if (store.pending.has(resourceId)) return;
    // Clicked before the answer arrived: wait for it.
    if (store.status === "unknown") await load();
    if (store.status === "unknown") {
      toast.error("Couldn't reach the server. Try again.");
      return;
    }
    if (store.status === "signed-out") return goToSignIn();
    if ((await change(resourceId, !store.ids.has(resourceId))) === "signed-out") goToSignIn();
  }, [resourceId, goToSignIn]);

  const status: SavedStatus =
    snapshot.status === "ready" ? (snapshot.ids.has(resourceId) ? "saved" : "not-saved") : snapshot.status;
  return { status, pending: snapshot.pending.has(resourceId), toggle };
}

// Who is signed in, from the same shared answer as the save controls: resolves once it is known
// ("unknown" when the server could not be reached). For controls that need an account but are not
// about saving, such as "Add to to-do".
export function useSignedInCheck(): () => Promise<"signed-in" | "signed-out" | "unknown"> {
  useEffect(ensureLoaded, []);
  return useCallback(async () => {
    if (store.status === "unknown") await load();
    return store.status === "ready" ? "signed-in" : store.status === "signed-out" ? "signed-out" : "unknown";
  }, []);
}

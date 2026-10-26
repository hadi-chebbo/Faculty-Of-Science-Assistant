"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TodoCard } from "@/services/todos/types";
import { boardRequest } from "@/lib/board-api";

export type Edit = { title?: string; note?: string };
export type SaveStatus = "idle" | "saving" | "saved" | "retrying" | "invalid" | "failed";
export type SaveInfo = { status: SaveStatus; invalidFields: string[] };

const IDLE: SaveInfo = { status: "idle", invalidFields: [] };
const DEBOUNCE_MS = 500;
// Waits between tries after a failed save: 1 s, 2 s, 4 s, 8 s, then 15 s. After this many failed
// tries in a row the saver gives up until the next edit.
const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000, 15000, 15000, 15000];

type Entry = { dirty: Edit; timer: ReturnType<typeof setTimeout> | null; running: boolean; discarded: boolean };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Autosave for the card view. Typing is collected per card and sent about half a second after it
// stops; requests for a card go one at a time and always carry the newest text. Only the fields
// that changed are sent, so a title the server refuses does not stop the note from saving.
//   - network or server errors are retried with a growing wait;
//   - a 400 is shown to the student (never retried);
//   - a session that cannot be renewed hands over to `onSignedOut`;
//   - `flush` sends at once (closing the card view); `discard` forgets unsent text (deleting).
// The saver lives in the board, so a save still finishes after the card view has closed.
export function useCardSaver({
  onSaved,
  onSignedOut,
}: {
  onSaved: (card: TodoCard) => void;
  onSignedOut: () => void;
}) {
  const entries = useRef(new Map<string, Entry>());
  const [info, setInfo] = useState<Record<string, SaveInfo>>({});
  const handlers = useRef({ onSaved, onSignedOut });
  useEffect(() => {
    handlers.current = { onSaved, onSignedOut };
  });

  const set = useCallback((id: string, next: SaveInfo) => setInfo((all) => ({ ...all, [id]: next })), []);
  const entryOf = (id: string) => {
    let entry = entries.current.get(id);
    if (!entry) {
      entry = { dirty: {}, timer: null, running: false, discarded: false };
      entries.current.set(id, entry);
    }
    return entry;
  };

  const run = useCallback(
    async (id: string) => {
      const entry = entryOf(id);
      if (entry.running) return;
      entry.running = true;
      let failures = 0;
      let renewedOnce = false;
      try {
        while (!entry.discarded && Object.keys(entry.dirty).length > 0) {
          const sending = entry.dirty;
          entry.dirty = {};
          set(id, { status: failures > 0 ? "retrying" : "saving", invalidFields: [] });
          const putBack = () => {
            entry.dirty = { ...sending, ...entry.dirty };
          };
          let response: Response | null = null;
          try {
            response = await boardRequest("PATCH", `/${id}`, sending);
          } catch {
            response = null;
          }
          if (entry.discarded) break;

          if (response?.ok) {
            failures = 0;
            handlers.current.onSaved(((await response.json()) as { card: TodoCard }).card);
            if (Object.keys(entry.dirty).length === 0) set(id, { status: "saved", invalidFields: [] });
          } else if (response?.status === 401) {
            putBack();
            if (renewedOnce) {
              handlers.current.onSignedOut();
              return;
            }
            // boardRequest already tried to renew; a second 401 means the session is gone.
            renewedOnce = true;
          } else if (response?.status === 400) {
            const { fields = [] } = (await response.json().catch(() => ({}))) as { fields?: string[] };
            // Keep what was fine, drop what the server refused.
            const refused = fields.filter((f) => f in sending);
            const kept =
              refused.length === 0 ? {} : Object.fromEntries(Object.entries(sending).filter(([key]) => !refused.includes(key)));
            entry.dirty = { ...kept, ...entry.dirty };
            set(id, { status: "invalid", invalidFields: refused });
            if (refused.length === 0 || Object.keys(entry.dirty).length === 0) break;
          } else if (response && response.status >= 400 && response.status < 500) {
            // 403 or 404: retrying cannot help (the card is gone or the request was refused).
            set(id, { status: "failed", invalidFields: [] });
            break;
          } else {
            putBack();
            if (failures >= BACKOFF_MS.length) {
              set(id, { status: "failed", invalidFields: [] });
              break;
            }
            set(id, { status: "retrying", invalidFields: [] });
            await sleep(BACKOFF_MS[failures]);
            failures += 1;
          }
        }
      } finally {
        entry.running = false;
      }
    },
    [set],
  );

  // Records a change and sends it once typing has paused.
  const edit = useCallback(
    (id: string, change: Edit) => {
      const entry = entryOf(id);
      entry.discarded = false;
      entry.dirty = { ...entry.dirty, ...change };
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => void run(id), DEBOUNCE_MS);
      setInfo((all) => {
        const now = all[id] ?? IDLE;
        // Typing in a field clears its error; a retry in progress keeps saying so.
        const invalidFields = now.invalidFields.filter((f) => !(f in change));
        return { ...all, [id]: { status: now.status === "retrying" ? "retrying" : "saving", invalidFields } };
      });
    },
    [run],
  );

  // Sends whatever is waiting right now (the card view is closing).
  const flush = useCallback(
    (id: string) => {
      const entry = entries.current.get(id);
      if (!entry) return;
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = null;
      void run(id);
    },
    [run],
  );

  // Forgets unsent text, for a card that is being deleted.
  const discard = useCallback((id: string) => {
    const entry = entries.current.get(id);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    entry.dirty = {};
    entry.discarded = true;
  }, []);

  // The page is being hidden or closed: send what is waiting in a request that outlives the page.
  useEffect(() => {
    function sendNow() {
      for (const [id, entry] of entries.current) {
        if (entry.discarded || Object.keys(entry.dirty).length === 0) continue;
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = null;
        const sending = entry.dirty;
        entry.dirty = {};
        void fetch(`/api/v1/todos/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(sending),
          keepalive: true,
        }).catch(() => {});
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") sendNow();
    };
    window.addEventListener("pagehide", sendNow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", sendNow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return { info, edit, flush, discard };
}

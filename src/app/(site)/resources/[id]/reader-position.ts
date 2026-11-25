// The reading position (a page number) remembered per resource in the browser. It is only a place
// to continue from: opening or reading a file is never progress. Every access can throw (private
// mode, blocked storage), and none of that may break the reader.

export function lastPageKey(resourceId: string): string {
  return `reader:last-page:${resourceId}`;
}

import { RESOURCE_TYPES, type ResourceType } from "@/db/constants";

type Store = Pick<Storage, "getItem" | "setItem">;
type RemovableStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStore(): Store | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLastPage(resourceId: string, store: Store | null = browserStore()): number | null {
  try {
    const raw = store?.getItem(lastPageKey(resourceId));
    if (!raw || !/^\d{1,6}$/.test(raw)) return null;
    return Number(raw);
  } catch {
    return null;
  }
}

export function writeLastPage(resourceId: string, page: number, store: Store | null = browserStore()): void {
  try {
    store?.setItem(lastPageKey(resourceId), String(page));
  } catch {
    // Nowhere to remember it; the reader works the same.
  }
}

// Only a stored page after the first and inside the file is worth offering.
export function pageToOffer(stored: number | null, total: number): number | null {
  return stored !== null && stored > 1 && stored <= total ? stored : null;
}

// Only a "#page=N" with N after the first page and inside the file is a place to jump to (Home's Resume link).
export function pageFromHash(hash: string, total: number): number | null {
  const match = /^#page=(\d{1,6})$/.exec(hash);
  if (!match) return null;
  const page = Number(match[1]);
  return page > 1 && page <= total ? page : null;
}

// The file read last in this browser, for Home's "Continue where you left off". Like the page, it is
// only a place to continue from, never progress. The page itself is read from `reader:last-page:ID`.
export const LAST_READ_KEY = "reader:last-read";

export type LastRead = { id: string; title: string; courseCode: string; type: ResourceType; at: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT = 300;

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_TEXT;
}

export function writeLastRead(entry: LastRead, store: Store | null = browserStore()): void {
  try {
    store?.setItem(LAST_READ_KEY, JSON.stringify(entry));
  } catch {
    // Nowhere to remember it.
  }
}

export function readLastRead(store: Store | null = browserStore()): LastRead | null {
  try {
    const raw = store?.getItem(LAST_READ_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { id, title, courseCode, type, at } = value as Record<string, unknown>;
    if (typeof id !== "string" || !UUID.test(id) || !isText(title) || !isText(courseCode) || !isText(at)) return null;
    if (typeof type !== "string" || !(RESOURCE_TYPES as readonly string[]).includes(type)) return null;
    return { id, title, courseCode, type: type as ResourceType, at };
  } catch {
    return null;
  }
}

export function clearLastRead(store: RemovableStore | null = browserStoreRemovable()): void {
  try {
    store?.removeItem(LAST_READ_KEY);
  } catch {
    // Nothing to clear.
  }
}

function browserStoreRemovable(): RemovableStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

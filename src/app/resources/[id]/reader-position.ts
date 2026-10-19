// The reading position (a page number) remembered per resource in the browser. It is only a place
// to continue from: opening or reading a file is never progress. Every access can throw (private
// mode, blocked storage), and none of that may break the reader.

export function lastPageKey(resourceId: string): string {
  return `reader:last-page:${resourceId}`;
}

type Store = Pick<Storage, "getItem" | "setItem">;

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

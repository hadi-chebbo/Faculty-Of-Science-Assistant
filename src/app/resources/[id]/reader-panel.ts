// Whether the Contents panel is open on a wide screen, remembered per browser (not per file: it is
// a habit, not a place in a document). Every access can throw (private mode, blocked storage), and
// none of that may break the reader.

export const CONTENTS_OPEN_KEY = "reader:contents-open";

type Store = Pick<Storage, "getItem" | "setItem">;

function browserStore(): Store | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Closed unless it was left open.
export function readContentsOpen(store: Store | null = browserStore()): boolean {
  try {
    return store?.getItem(CONTENTS_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeContentsOpen(open: boolean, store: Store | null = browserStore()): void {
  try {
    store?.setItem(CONTENTS_OPEN_KEY, open ? "1" : "0");
  } catch {
    // Nowhere to remember it; the panel works the same.
  }
}

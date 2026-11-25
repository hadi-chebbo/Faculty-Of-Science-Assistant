import { describe, expect, it } from "vitest";
import {
  LAST_READ_KEY,
  clearLastRead,
  lastPageKey,
  pageFromHash,
  pageToOffer,
  readLastPage,
  readLastRead,
  writeLastPage,
  writeLastRead,
} from "@/lib/reader-position";

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("the remembered page", () => {
  it("is stored under a key per resource", () => {
    const store = memoryStore();
    writeLastPage("abc", 7, store);
    expect(store.data.get("reader:last-page:abc")).toBe("7");
    expect(lastPageKey("abc")).toBe("reader:last-page:abc");
    expect(readLastPage("abc", store)).toBe(7);
    expect(readLastPage("other", store)).toBeNull();
  });

  it("ignores stored values that are not a page number", () => {
    for (const value of ["", "x", "-1", "2.5", "1e3", "{}"]) {
      expect(readLastPage("a", memoryStore({ [lastPageKey("a")]: value })), value).toBeNull();
    }
  });

  it("does not throw when the storage does", () => {
    expect(readLastPage("a", throwing)).toBeNull();
    expect(() => writeLastPage("a", 3, throwing)).not.toThrow();
  });

  it("does not throw when there is no storage", () => {
    expect(readLastPage("a", null)).toBeNull();
    expect(() => writeLastPage("a", 3, null)).not.toThrow();
  });
});

describe("pageToOffer", () => {
  it("offers a stored page after the first and inside the file", () => {
    expect(pageToOffer(2, 12)).toBe(2);
    expect(pageToOffer(12, 12)).toBe(12);
  });

  it("offers nothing otherwise", () => {
    expect(pageToOffer(null, 12)).toBeNull();
    expect(pageToOffer(1, 12)).toBeNull();
    expect(pageToOffer(13, 12)).toBeNull();
    expect(pageToOffer(0, 12)).toBeNull();
  });
});

const ID = "3f2b8a4e-1c5d-4e6f-8a9b-0c1d2e3f4a5b";
const entry = { id: ID, title: "Sample lecture", courseCode: "DEMO301", type: "lecture" as const, at: "2026-11-25T10:00:00.000Z" };

describe("the last read file", () => {
  it("is stored as one record and read back", () => {
    const store = memoryStore();
    writeLastRead(entry, store);
    expect(store.data.has(LAST_READ_KEY)).toBe(true);
    expect(LAST_READ_KEY).toBe("reader:last-read");
    expect(readLastRead(store)).toEqual(entry);
  });

  it("is null when nothing is stored", () => {
    expect(readLastRead(memoryStore())).toBeNull();
  });

  it("ignores a record that is malformed or has wrong fields", () => {
    const bad = [
      "",
      "not json",
      "[]",
      "null",
      JSON.stringify({ ...entry, id: "123" }),
      JSON.stringify({ ...entry, title: "" }),
      JSON.stringify({ ...entry, title: "x".repeat(301) }),
      JSON.stringify({ ...entry, courseCode: "" }),
      JSON.stringify({ ...entry, type: "video" }),
      JSON.stringify({ ...entry, at: 5 }),
      JSON.stringify({ id: ID }),
    ];
    for (const value of bad) expect(readLastRead(memoryStore({ [LAST_READ_KEY]: value })), value).toBeNull();
  });

  it("can be cleared", () => {
    const store = memoryStore();
    writeLastRead(entry, store);
    clearLastRead({ ...store, removeItem: (key: string) => void store.data.delete(key) });
    expect(readLastRead(store)).toBeNull();
  });

  it("does not throw when the storage does", () => {
    expect(readLastRead(throwing)).toBeNull();
    expect(() => writeLastRead(entry, throwing)).not.toThrow();
    expect(() => clearLastRead({ ...throwing, removeItem: throwing.getItem })).not.toThrow();
  });
});

describe("pageFromHash", () => {
  it("reads #page=N inside the file after the first page", () => {
    expect(pageFromHash("#page=7", 12)).toBe(7);
    expect(pageFromHash("#page=12", 12)).toBe(12);
    expect(pageFromHash("#page=2", 12)).toBe(2);
  });
  it("ignores everything else", () => {
    for (const hash of ["", "#", "#page=1", "#page=0", "#page=13", "#page=-3", "#page=2.5", "#page=x", "#page=7&x=1", "#other", "page=7", "#page=1000000000"]) {
      expect(pageFromHash(hash, 12), hash).toBeNull();
    }
  });
});

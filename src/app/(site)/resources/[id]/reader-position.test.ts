import { describe, expect, it } from "vitest";
import { lastPageKey, pageToOffer, readLastPage, writeLastPage } from "./reader-position";

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

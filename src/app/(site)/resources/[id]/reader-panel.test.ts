import { describe, expect, it } from "vitest";
import { CONTENTS_OPEN_KEY, readContentsOpen, writeContentsOpen } from "./reader-panel";

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
    throw new Error("quota");
  },
};

describe("the Contents panel state", () => {
  it("is closed by default", () => {
    expect(readContentsOpen(memoryStore())).toBe(false);
  });

  it("remembers open and closed", () => {
    const store = memoryStore();
    writeContentsOpen(true, store);
    expect(store.data.get(CONTENTS_OPEN_KEY)).toBe("1");
    expect(readContentsOpen(store)).toBe(true);
    writeContentsOpen(false, store);
    expect(readContentsOpen(store)).toBe(false);
  });

  it("treats anything unexpected as closed", () => {
    expect(readContentsOpen(memoryStore({ [CONTENTS_OPEN_KEY]: "yes" }))).toBe(false);
    expect(readContentsOpen(memoryStore({ [CONTENTS_OPEN_KEY]: "" }))).toBe(false);
  });

  it("does not throw when storage does, or when there is none", () => {
    expect(readContentsOpen(throwing)).toBe(false);
    expect(() => writeContentsOpen(true, throwing)).not.toThrow();
    expect(readContentsOpen(null)).toBe(false);
    expect(() => writeContentsOpen(true, null)).not.toThrow();
  });
});

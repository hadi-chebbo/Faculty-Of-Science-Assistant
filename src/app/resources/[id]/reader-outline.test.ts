import { describe, expect, it } from "vitest";
import { activeRowId, flattenOutline, hasLinks, resolveOutline, type OutlineSource, type RawOutlineItem } from "./reader-outline";

// Page objects are references; the fake document knows which index each one is.
const ref = (num: number) => ({ num, gen: 0 });
function source(raw: readonly RawOutlineItem[] | null, named: Record<string, readonly unknown[] | null> = {}): OutlineSource {
  return {
    getOutline: async () => raw,
    getDestination: async (id) => named[id] ?? null,
    getPageIndex: async (target) => {
      const { num } = target;
      if (num < 100) throw new Error("unknown page");
      return num - 100;
    },
  };
}

describe("resolveOutline", () => {
  it("maps entries to 1-based pages through the page references, keeping the nesting", async () => {
    const nodes = await resolveOutline(
      source([
        { title: "Intro", dest: [ref(100), { name: "Fit" }], items: [] },
        { title: "Sets", dest: [ref(102)], items: [{ title: "Definitions", dest: [ref(103)] }] },
      ]),
      12,
    );
    expect(nodes).toEqual([
      { title: "Intro", page: 1, children: [] },
      { title: "Sets", page: 3, children: [{ title: "Definitions", page: 4, children: [] }] },
    ]);
  });

  it("resolves named destinations", async () => {
    const nodes = await resolveOutline(source([{ title: "Proofs", dest: "chapter3" }], { chapter3: [ref(108), { name: "XYZ" }] }), 12);
    expect(nodes[0].page).toBe(9);
  });

  it("accepts a page index given as a number", async () => {
    const nodes = await resolveOutline(source([{ title: "Direct", dest: [4, { name: "Fit" }] }]), 12);
    expect(nodes[0].page).toBe(5);
  });

  it("leaves the page empty when the destination is missing, unknown or outside the file", async () => {
    const nodes = await resolveOutline(
      source([
        { title: "Web link", dest: null },
        { title: "Missing name", dest: "nope" },
        { title: "Broken ref", dest: [ref(5)] },
        { title: "Past the end", dest: [ref(120)] },
        { title: "Negative", dest: [-1] },
      ]),
      12,
    );
    expect(nodes.map((n) => n.page)).toEqual([null, null, null, null, null]);
  });

  it("keeps an entry without a page when a child has one", async () => {
    const nodes = await resolveOutline(source([{ title: "Part", dest: null, items: [{ title: "Chapter", dest: [ref(101)] }] }]), 12);
    expect(nodes[0].page).toBeNull();
    expect(nodes[0].children[0].page).toBe(2);
    expect(hasLinks(nodes)).toBe(true);
  });

  it("is empty when the file has no outline or reading it fails", async () => {
    expect(await resolveOutline(source(null), 12)).toEqual([]);
    expect(await resolveOutline(source([]), 12)).toEqual([]);
    const failing: OutlineSource = { ...source([]), getOutline: async () => Promise.reject(new Error("boom")) };
    expect(await resolveOutline(failing, 12)).toEqual([]);
  });

  it("tidies titles", async () => {
    const nodes = await resolveOutline(source([{ title: "  1.  Intro \n to sets ", dest: [ref(100)] }, { title: "   ", dest: [ref(100)] }]), 12);
    expect(nodes.map((n) => n.title)).toEqual(["1. Intro to sets", "Untitled"]);
  });

  it("cuts a huge outline", async () => {
    const many = Array.from({ length: 1500 }, (_, i) => ({ title: `Entry ${i}`, dest: [ref(100)] }));
    const nodes = await resolveOutline(source(many), 12);
    expect(nodes).toHaveLength(1000);
  });
});

describe("hasLinks", () => {
  it("is false when no entry leads anywhere", () => {
    expect(hasLinks([{ title: "a", page: null, children: [{ title: "b", page: null, children: [] }] }])).toBe(false);
    expect(hasLinks([])).toBe(false);
  });
});

describe("activeRowId", () => {
  const rows = flattenOutline([
    { title: "1 Intro", page: 1, children: [] },
    {
      title: "2 Sets",
      page: 3,
      children: [
        { title: "2.1 Definitions", page: 4, children: [] },
        { title: "2.2 Examples", page: 6, children: [] },
      ],
    },
    { title: "3 Proofs", page: 9, children: [] },
  ]);

  it("lists the entries in reading order with their depth", () => {
    expect(rows.map((r) => [r.node.title, r.depth])).toEqual([
      ["1 Intro", 0],
      ["2 Sets", 0],
      ["2.1 Definitions", 1],
      ["2.2 Examples", 1],
      ["3 Proofs", 0],
    ]);
  });

  it("picks the entry the current page falls in", () => {
    const title = (page: number) => rows[activeRowId(rows, page)!].node.title;
    expect(title(1)).toBe("1 Intro");
    expect(title(2)).toBe("1 Intro");
    expect(title(3)).toBe("2 Sets");
    expect(title(5)).toBe("2.1 Definitions");
    expect(title(8)).toBe("2.2 Examples");
    expect(title(12)).toBe("3 Proofs");
  });

  it("prefers the later, deeper entry when two start on the same page", () => {
    const same = flattenOutline([{ title: "Chapter", page: 2, children: [{ title: "Section", page: 2, children: [] }] }]);
    expect(same[activeRowId(same, 2)!].node.title).toBe("Section");
  });

  it("is null before the first entry and when nothing has a page", () => {
    const late = flattenOutline([{ title: "Late", page: 5, children: [] }]);
    expect(activeRowId(late, 2)).toBeNull();
    expect(activeRowId(flattenOutline([{ title: "x", page: null, children: [] }]), 2)).toBeNull();
    expect(activeRowId([], 1)).toBeNull();
  });
});

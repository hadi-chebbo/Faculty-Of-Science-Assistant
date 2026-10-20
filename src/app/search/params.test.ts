import { describe, expect, it } from "vitest";
import { parseSearchParams, searchHref } from "./params";

describe("parseSearchParams", () => {
  it("reads the query, the chip, the section and the page", () => {
    expect(parseSearchParams({ q: "  final 2024 ", type: "exam", show: "files", page: "3" })).toEqual({
      q: "final 2024",
      type: "exam",
      show: "files",
      page: 3,
    });
  });

  it("drops what it cannot use", () => {
    expect(parseSearchParams({ type: "nope", show: "all", page: "0" })).toEqual({ q: "", type: undefined, show: undefined, page: 1 });
    expect(parseSearchParams({ page: "abc" }).page).toBe(1);
    expect(parseSearchParams({ page: "99999999" }).page).toBe(1);
    expect(parseSearchParams({})).toEqual({ q: "", type: undefined, show: undefined, page: 1 });
  });

  it("uses the first of a repeated parameter", () => {
    expect(parseSearchParams({ q: ["one", "two"], type: ["lecture", "exam"] })).toMatchObject({ q: "one", type: "lecture" });
  });

  it("cuts a long query to the longest length", () => {
    expect(parseSearchParams({ q: "é".repeat(150) }).q).toBe("é".repeat(100));
  });

  it("cuts by characters, the way the service counts them", () => {
    expect(parseSearchParams({ q: "𝐀".repeat(150) }).q).toBe("𝐀".repeat(100));
    expect(Array.from(parseSearchParams({ q: "😀".repeat(60) }).q)).toHaveLength(60);
  });

  it("keeps an explicit 'all'", () => {
    expect(parseSearchParams({ type: "all" }).type).toBe("all");
  });
});

describe("searchHref", () => {
  it("leaves out what is not set", () => {
    expect(searchHref({})).toBe("/search");
    expect(searchHref({ q: "graphs", page: 1 })).toBe("/search?q=graphs");
    expect(searchHref({ q: "final 2024", type: "exam", show: "files", page: 2 })).toBe("/search?q=final+2024&type=exam&show=files&page=2");
    expect(searchHref({ q: "a&b=c#d" })).toBe("/search?q=a%26b%3Dc%23d");
  });
});

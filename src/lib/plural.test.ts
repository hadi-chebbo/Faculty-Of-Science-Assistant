import { describe, expect, it } from "vitest";
import { noun, plural } from "./plural";

describe("plural", () => {
  it("uses the singular for exactly one", () => {
    expect(plural(1, "file")).toBe("1 file");
  });
  it("uses the plural for zero and many", () => {
    expect(plural(0, "file")).toBe("0 files");
    expect(plural(13, "file")).toBe("13 files");
  });
  it("accepts an irregular plural", () => {
    expect(plural(2, "city", "cities")).toBe("2 cities");
  });
  it("noun gives only the word", () => {
    expect(noun(1, "file")).toBe("file");
    expect(noun(2, "file")).toBe("files");
  });
});

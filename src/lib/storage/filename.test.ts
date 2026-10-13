import { describe, expect, it } from "vitest";
import { safeFilename } from "./filename";

describe("safeFilename", () => {
  it("keeps an ordinary name", () => {
    expect(safeFilename("Lecture 1.pdf")).toBe("Lecture 1.pdf");
  });

  it("drops quotes, slashes, semicolons and control characters", () => {
    expect(safeFilename('a"b\\c/d;e\r\nf\u0000g.pdf')).toBe("abcdefg.pdf");
  });

  it("falls back for an empty or missing name", () => {
    expect(safeFilename(undefined)).toBe("file.pdf");
    expect(safeFilename('  ";/ ')).toBe("file.pdf");
  });

  it("limits the length", () => {
    expect(safeFilename("x".repeat(500)).length).toBe(150);
  });
});

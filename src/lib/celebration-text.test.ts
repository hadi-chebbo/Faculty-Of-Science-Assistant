import { describe, expect, it } from "vitest";
import { allFiles, chapterFinishedDescription } from "./celebration-text";

describe("celebration text", () => {
  it("chapter finished with several files", () => {
    expect(chapterFinishedDescription("Layouts", 5)).toBe("Layouts, all 5 files done.");
  });
  it("chapter finished with one file", () => {
    expect(chapterFinishedDescription("Layouts", 1)).toBe("Layouts, 1 file done.");
  });
  it("course finished names its files", () => {
    expect(allFiles(13)).toBe("all 13 files");
    expect(allFiles(1)).toBe("the only file");
  });
});

import { describe, expect, it } from "vitest";
import { chapterTitle, courseTitle } from "./page-title";

describe("page titles", () => {
  it("names a course by code and title", () => {
    expect(courseTitle({ code: "I3305", title: "GUI" })).toBe("I3305 GUI");
  });
  it("names a chapter by code, number and title", () => {
    expect(chapterTitle({ code: "I3305" }, { position: 2, title: "Layouts" })).toBe("I3305 · Chapter 2: Layouts");
  });
});

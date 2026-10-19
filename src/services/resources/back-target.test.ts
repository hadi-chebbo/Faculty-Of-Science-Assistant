import { describe, expect, it } from "vitest";
import { readerBackTarget } from "./back-target";

const base = { courseCode: "DEMO301", type: "lecture" as const, chapterPosition: null, courseHasChapters: false };

describe("readerBackTarget", () => {
  it("sends an exam to the Previous exams area, whatever else is true", () => {
    expect(readerBackTarget({ ...base, type: "exam" })).toBe("/courses/DEMO301?tab=exams");
    expect(readerBackTarget({ ...base, type: "exam", courseHasChapters: true })).toBe("/courses/DEMO301?tab=exams");
  });

  it("sends a resource of a chapter to that chapter", () => {
    expect(readerBackTarget({ ...base, chapterPosition: 2, courseHasChapters: true })).toBe(
      "/courses/DEMO301/chapters/2",
    );
  });

  it("sends a resource with no chapter to Other material when the course has chapters", () => {
    expect(readerBackTarget({ ...base, courseHasChapters: true })).toBe("/courses/DEMO301?tab=other");
  });

  it("sends a resource of a course without chapters to the course page", () => {
    expect(readerBackTarget(base)).toBe("/courses/DEMO301");
  });

  it("encodes the course code", () => {
    expect(readerBackTarget({ ...base, courseCode: "A B/1" })).toBe("/courses/A%20B%2F1");
  });
});

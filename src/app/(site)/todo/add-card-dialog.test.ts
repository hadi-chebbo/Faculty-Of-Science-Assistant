import { describe, expect, it } from "vitest";
import { canAddCard } from "./add-card-dialog";

const file = { id: "f1", title: "Lecture 1", type: "lecture", courseCode: "DEMO301" } as never;

describe("canAddCard", () => {
  it("needs a title", () => {
    expect(canAddCard("", null)).toBe(false);
    expect(canAddCard("   ", null)).toBe(false);
    expect(canAddCard(" Read ch. 2 ", null)).toBe(true);
  });
  it("allows an empty title when a file is linked", () => {
    expect(canAddCard("", file)).toBe(true);
  });
});

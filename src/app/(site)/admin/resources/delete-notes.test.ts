import { describe, expect, it } from "vitest";
import { deleteNotes } from "./delete-notes";

describe("deleteNotes", () => {
  it("lists nothing for an unpublished resource without solutions", () => {
    expect(deleteNotes(false, 0)).toEqual([]);
  });

  it("warns that a published resource disappears for students", () => {
    expect(deleteNotes(true, 0)).toEqual(["It is published: students will no longer see it."]);
  });

  it("counts solutions, singular and plural", () => {
    expect(deleteNotes(false, 1)).toEqual(["Its 1 solution is kept but will no longer be linked to it."]);
    expect(deleteNotes(false, 2)).toEqual(["Its 2 solutions are kept but will no longer be linked to it."]);
  });

  it("lists both, published first", () => {
    expect(deleteNotes(true, 3)).toEqual([
      "It is published: students will no longer see it.",
      "Its 3 solutions are kept but will no longer be linked to it.",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { maskEmail } from "./mask-email";

describe("maskEmail", () => {
  it("keeps the first character and the full domain", () => {
    expect(maskEmail("sara@gmail.com")).toBe("s•••@gmail.com");
  });
  it("applies the same rule to a one-character local part", () => {
    expect(maskEmail("s@gmail.com")).toBe("s•••@gmail.com");
  });
  it("splits at the last @", () => {
    expect(maskEmail("a@b@example.org")).toBe("a•••@example.org");
  });
  it("does not fail on text that is not an address", () => {
    expect(maskEmail("nobody")).toBe("n•••");
    expect(maskEmail("")).toBe("");
  });
});

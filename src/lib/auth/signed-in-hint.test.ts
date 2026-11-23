import { describe, expect, it } from "vitest";
import { hasSignedInHint, SIGNED_IN_HINT_COOKIE } from "./signed-in-hint";

describe("hasSignedInHint", () => {
  it("names the cookie ua_signed_in", () => {
    expect(SIGNED_IN_HINT_COOKIE).toBe("ua_signed_in");
  });
  it("is true when the hint is present", () => {
    expect(hasSignedInHint("ua_signed_in=1")).toBe(true);
    expect(hasSignedInHint("a=b; ua_signed_in=1; c=d")).toBe(true);
    expect(hasSignedInHint("a=b;ua_signed_in=1")).toBe(true);
  });
  it("is false when absent or empty", () => {
    expect(hasSignedInHint("")).toBe(false);
    expect(hasSignedInHint("a=b; c=d")).toBe(false);
  });
  it("needs the value 1", () => {
    expect(hasSignedInHint("ua_signed_in=0")).toBe(false);
    expect(hasSignedInHint("ua_signed_in=")).toBe(false);
    expect(hasSignedInHint("ua_signed_in=10")).toBe(false);
  });
  it("needs the exact name", () => {
    expect(hasSignedInHint("xua_signed_in=1")).toBe(false);
    expect(hasSignedInHint("ua_signed_in_x=1")).toBe(false);
    expect(hasSignedInHint("a=ua_signed_in=1")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { signInReasonFor } from "./sign-in-reason";

describe("signInReasonFor", () => {
  it("names the private pages", () => {
    expect(signInReasonFor("/saved")).toBe("Sign in to see your saved files");
    expect(signInReasonFor("/todo")).toBe("Sign in to use your to-do board");
    expect(signInReasonFor("/progress?x=1")).toBe("Sign in to see your progress");
  });
  it("ignores everything else", () => {
    expect(signInReasonFor(null)).toBeNull();
    expect(signInReasonFor("/")).toBeNull();
    expect(signInReasonFor("/admin")).toBeNull();
    expect(signInReasonFor("//evil.com/saved")).toBeNull();
    expect(signInReasonFor("/saved-not")).toBeNull();
  });
});

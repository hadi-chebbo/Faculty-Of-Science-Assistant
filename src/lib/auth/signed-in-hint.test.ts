import { describe, expect, it } from "vitest";
import { BAND_HEIGHT_KEY, hasSignedInHint, saneBandHeight, SIGNED_IN_HINT_COOKIE, SIGNED_IN_SCRIPT } from "./signed-in-hint";

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

// Runs the real pre-paint script against a stub document and storage, so it cannot drift from the helpers.
function runScript(cookie: string, stored: string | null, storageThrows = false) {
  const attributes = new Map<string, string>();
  const properties = new Map<string, string>();
  const documentStub = {
    cookie,
    documentElement: {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      style: { setProperty: (name: string, value: string) => properties.set(name, value) },
    },
  };
  const storageStub = {
    getItem: (key: string) => {
      if (storageThrows) throw new Error("blocked");
      return key === BAND_HEIGHT_KEY ? stored : null;
    },
  };
  new Function("document", "localStorage", SIGNED_IN_SCRIPT)(documentStub, storageStub);
  return { marked: attributes.get("data-signed-in") === "1", height: properties.get("--home-band-h") ?? null };
}

describe("SIGNED_IN_SCRIPT", () => {
  it("marks the page exactly when hasSignedInHint would", () => {
    for (const cookie of ["ua_signed_in=1", "a=b; ua_signed_in=1", "", "ua_signed_in=0", "xua_signed_in=1", "a=ua_signed_in=1"]) {
      expect(runScript(cookie, null).marked).toBe(hasSignedInHint(cookie));
    }
  });

  it("sets the band height exactly when saneBandHeight accepts the stored value", () => {
    for (const stored of ["262", "80", "600", "79", "601", "26.5", "abc", "", null]) {
      const expected = saneBandHeight(stored);
      expect(runScript("ua_signed_in=1", stored).height).toBe(expected === null ? null : `${expected}px`);
    }
  });

  it("sets no height without the hint, and survives blocked storage", () => {
    expect(runScript("", "262").height).toBeNull();
    expect(runScript("ua_signed_in=1", "262", true)).toEqual({ marked: true, height: null });
  });
});

import { describe, expect, it } from "vitest";
import { isStorageKey, newResourceFileKey } from "./keys";
import { looksLikePdf } from "./pdf";

describe("newResourceFileKey", () => {
  it("has the resources/<uuid>.pdf shape and is valid", () => {
    const key = newResourceFileKey();
    expect(key).toMatch(/^resources\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/);
    expect(isStorageKey(key)).toBe(true);
  });

  it("is unique", () => {
    expect(newResourceFileKey()).not.toBe(newResourceFileKey());
  });
});

describe("isStorageKey", () => {
  it.each(["resources/a.pdf", "a", "a-b_c.d/e9"])("accepts %s", (key) => {
    expect(isStorageKey(key)).toBe(true);
  });

  it.each(["../x", "/x", "a//b", "a/../b", "a/", "Upper/x", "a b", "a\\b", ""])("rejects %j", (key) => {
    expect(isStorageKey(key)).toBe(false);
  });
});

describe("looksLikePdf", () => {
  it("accepts bytes starting with %PDF-", () => {
    expect(looksLikePdf(new TextEncoder().encode("%PDF-1.7\n..."))).toBe(true);
  });

  it("rejects other or too-short bytes", () => {
    expect(looksLikePdf(new TextEncoder().encode("<html>"))).toBe(false);
    expect(looksLikePdf(new TextEncoder().encode("%PDF"))).toBe(false);
    expect(looksLikePdf(new Uint8Array())).toBe(false);
  });
});

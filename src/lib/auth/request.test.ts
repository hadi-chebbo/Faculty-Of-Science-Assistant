import { describe, expect, it } from "vitest";
import { clientIp, isSameOrigin, safeNextPath } from "./request";

const req = (headers: Record<string, string>) =>
  new Request("https://app.example.com/api/v1/auth/sign-in", { method: "POST", headers });

describe("isSameOrigin", () => {
  it("accepts the request's own origin", () => {
    expect(isSameOrigin(req({ origin: "https://app.example.com" }))).toBe(true);
  });

  it("falls back to the referer when there is no origin", () => {
    expect(isSameOrigin(req({ referer: "https://app.example.com/sign-in" }))).toBe(true);
    expect(isSameOrigin(req({ referer: "https://evil.example/sign-in" }))).toBe(false);
  });

  it("rejects a foreign, null, malformed or missing origin", () => {
    expect(isSameOrigin(req({ origin: "https://evil.example" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "https://app.example.com.evil.example" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "null" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "::::" }))).toBe(false);
    expect(isSameOrigin(req({}))).toBe(false);
  });

  it("does not let a matching referer rescue a foreign origin", () => {
    expect(isSameOrigin(req({ origin: "https://evil.example", referer: "https://app.example.com/" }))).toBe(false);
  });
});

describe("clientIp", () => {
  it("uses the first x-forwarded-for hop", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip, then to unknown", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.6" }))).toBe("203.0.113.6");
    expect(clientIp(req({}))).toBe("unknown");
  });

  it("caps the length", () => {
    expect(clientIp(req({ "x-forwarded-for": "a".repeat(500) }))).toHaveLength(64);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site relative paths", () => {
    expect(safeNextPath("/admin")).toBe("/admin");
    expect(safeNextPath("/admin/resources?page=2")).toBe("/admin/resources?page=2");
  });

  it("falls back for anything that could leave the site", () => {
    for (const value of [
      "//evil.example",
      "///evil.example",
      "/\\evil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "admin",
      "",
      null,
      undefined,
      "/admin\r\nSet-Cookie: x=1",
      "/%2F%2Fevil.example/../..",
    ]) {
      const result = safeNextPath(value as string | null | undefined);
      // Always a path on this site: one leading slash, never "//" or a backslash.
      expect(result, String(value)).toMatch(/^\/(?![/\\])/);
    }
    for (const value of ["//evil.example", "/\\evil.example", "https://evil.example", "admin", "/admin\r\nSet-Cookie: x=1"]) {
      expect(safeNextPath(value), value).toBe("/admin");
    }
  });
});

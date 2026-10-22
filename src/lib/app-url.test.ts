import { describe, expect, it } from "vitest";
import { getAppUrl } from "./app-url";

describe("getAppUrl", () => {
  it("uses APP_URL and strips trailing slashes", () => {
    expect(getAppUrl({ APP_URL: "https://study.example.org/" })).toBe("https://study.example.org");
    expect(getAppUrl({ APP_URL: "http://localhost:3210" })).toBe("http://localhost:3210");
  });

  it("prefers APP_URL over the Vercel production domain", () => {
    expect(getAppUrl({ APP_URL: "https://a.example.org", VERCEL_PROJECT_PRODUCTION_URL: "b.vercel.app" })).toBe(
      "https://a.example.org",
    );
  });

  it("uses the Vercel production domain when APP_URL is unset or blank", () => {
    expect(getAppUrl({ VERCEL_PROJECT_PRODUCTION_URL: "b.vercel.app" })).toBe("https://b.vercel.app");
    expect(getAppUrl({ APP_URL: "  ", VERCEL_PROJECT_PRODUCTION_URL: "b.vercel.app" })).toBe("https://b.vercel.app");
  });

  it("falls back to localhost:3000", () => {
    expect(getAppUrl({})).toBe("http://localhost:3000");
  });

  it("rejects an APP_URL that is not an http(s) URL", () => {
    expect(() => getAppUrl({ APP_URL: "not a url" })).toThrow(/APP_URL/);
    expect(() => getAppUrl({ APP_URL: "ftp://example.org" })).toThrow(/APP_URL/);
  });
});
